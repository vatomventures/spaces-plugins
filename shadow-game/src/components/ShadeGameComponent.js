import {getSettings} from "../settings";
import {MAX_ROUNDS, MAXCOUNTDOWNSECONDS} from "../index";

const levenshtein = require("js-levenshtein");

const settings = getSettings();

export class ShadeGameComponent extends BaseComponent {

    currentRound = 0;
    numberOfRounds = 0;

    async onAction(action) {
        console.log(`onAction ShadeGameComponent received: ${JSON.stringify(action)}`);
        switch (action) {
            case 'action-start-game':
                await this.startGame();
                break;
            case 'action-start-round':
                await this.startRound();
                break;
            case 'action-stop-round':
                await this.stopRound();
                break;
            case 'action-end-game':
                await this.endGame();
                break;
            case 'action-remove-all':
                await this.removeAllImages();
                break;
        }
    }

    async startGame() {
        if (this.plugin.gameId) {
            this.plugin.menus.alert(null, 'There is already an active game');
            return;
        }
        const imageScreenId = await this.plugin.getField('imageScreenId');
        if (!imageScreenId) {
            this.plugin.menus.alert(null, 'There is no Image Object Id in setting for showing the images');
            return;
        }
        this.plugin.pictureId = imageScreenId;
        const instanceId = await this.plugin.world.getInstanceID();
        await fetch(`${settings.host}/new-game`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({instanceId})
        })
            .then(r => r.json()
                .then(json => this.plugin.gameId = json.id));
        const gameMasterId = await this.plugin.user.getID();
        await fetch(`${settings.host}/${this.plugin.gameId}/add-user-to-game`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                externalId: gameMasterId,
                displayName: await this.plugin.user.getDisplayName(),
                role: [1]
            })
        });
        for (let i = 1; i <= MAX_ROUNDS; i++) {
            if(!(await this.getField(`picture${i}`))) {
                break;
            }
            this.numberOfRounds++;
        }
        this.plugin.messages.send({action: 'msg-start-game', gameId: this.plugin.gameId, gameMasterId}, true);

        const countdownId = await this.plugin.getField("countdownId");
        if (!countdownId) {
          this.plugin.menus.alert(
            null,
            "There is no Countdown Object Id in setting for showing the countdown timer"
          );
          return;
        }
        this.plugin.countdownId = countdownId;

        const updateCountDown = async (data) => {
          await this.plugin.objects.update(this.plugin.countdownId, data);
        };
    
        var count = MAXCOUNTDOWNSECONDS;
        async function anim() {
          if (count > 0) {
            updateCountDown({ textValue: count });
            count--;
            setTimeout(anim, 1000);
          } else {
            updateCountDown({ textValue: "" });
          }
        }
        anim();
    }

    async endGame() {
        if (!this.plugin.gameId) {
            return;
        }
        const endGameP = fetch(`${settings.host}/${this.plugin.gameId}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                gameStatus: 2
            })
        });
        await this.plugin.objects.update(this.plugin.pictureId, {url: this.plugin.paths.absolute('gameToStart.png')});
        await this.plugin.messages.send({action: 'msg-end-game'}, true);
        await endGameP;
        this.numberOfRounds = 0;
        this.currentRound = 0;
    }

    async startRound() {
        if (!this.plugin.gameId) {
            return;
        }
        if (this.currentRound === this.numberOfRounds) {
            this.plugin.menus.alert(null, 'There are no more rounds');
            return;
        }
        this.currentRound++;
        await this.plugin.messages.send({action: 'msg-start-round'}, true);
        const url = await this.paths.absolute(await this.getField(`picture${this.currentRound}`));
        await this.plugin.objects.update(this.plugin.pictureId, {url});
    }

    async stopRound() {
        if (!this.plugin.gameId) {
            return;
        }
        await this.updateScores();
        await this.plugin.messages.send({action: 'msg-stop-round', scores: this.plugin.scores}, true)
    }

    async updateScores() {
        const correctAnswer = this.getField(`correct-answer${this.currentRound}`);
        const answers = Object.entries(this.plugin.answers);

        const unifyString = str => str ? str.toLowerCase().replace(/[ -_]/g, '') : undefined;

        const areEqual = (str1, str2) => str1 && str2 ? levenshtein(unifyString(str1), unifyString(str2)) <= 1 : false;

        const correctUsers = [];
        for (const answer of answers) {
            if (areEqual(answer[1], correctAnswer)) {
                const userId = answer[0];
                correctUsers.push(userId);
                this.plugin.scores[userId].score = this.plugin.scores[userId] === undefined ? 0 : this.plugin.scores[userId].score + 1;
            }
        }
        this.plugin.answers = {};
        await fetch(`${settings.host}/${this.plugin.gameId}/increase-scores`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                users: correctUsers
            })
        });

        this.plugin.menus.postMessage({action: 'msg-new-scores', scores: this.plugin.scores}, true)
    }

    async removeAllImages() {

        const nearbyObjects = await this.plugin.objects.fetchInRadius(this.fields.x || 0, this.fields.y || 0, 500);
        const nearbyImages = nearbyObjects.filter(obj => obj.id.includes(`object:shadegameplugin`));

        // Remove all
        await Promise.all(nearbyImages.map(c => this.plugin.objects.remove(c.id)))

    }
}
