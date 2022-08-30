import {getSettings} from "../settings";

const levenshtein = require("js-levenshtein");
const ShadeGamePlugin = require("../index");

const settings = getSettings();

export class ShadeGameComponent extends BaseComponent {

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
            case 'action-remove-all':
                await this.removeAllImages();
                break;
        }
    }

    async startGame() {
        await this.plugin.registerScoresOverlay();
        if (this.plugin.gameId) {
            this.plugin.menus.alert(null, 'There is already an active game');
            return;
        }
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
                role: 1
            })
        });
        this.plugin.messages.send({action: 'msg-start-game', gameId: this.plugin.gameId, gameMasterId}, true);
    }

    async startRound() {
        await this.plugin.messages.send({action: 'msg-start-round'}, true)
    }

    async stopRound() {
        await this.updateScores();
        await this.plugin.messages.send({action: 'msg-stop-round', scores: this.plugin.scores}, true)
    }

    async updateScores() {
        const correctAnswer = this.getField('correct-answer');
        const answers = Object.entries(this.plugin.answers);
        console.log(`Correct Answer: ${correctAnswer}. Answers: ${JSON.stringify(answers)}`);

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
        const nearbyImages = nearbyObjects.filter(obj => obj.id.includes(`object:${ShadeGamePlugin.id}`));

        // Remove all
        await Promise.all(nearbyImages.map(c => this.plugin.objects.remove(c.id)))

    }
}
