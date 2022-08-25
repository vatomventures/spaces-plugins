import {settingsDev} from "./settings";

/**
 * This is the main entry point for your plugin.
 *
 * All information regarding plugin development can be found at
 * https://developer.vatom.com/plugins/plugins/
 *
 * @license MIT
 * @author Vatom Inc.
 */
const levenshtein = require('js-levenshtein');

const settings = /*process.env.VATOM_ENV !== 'dev' ? settingsProd :*/ settingsDev;

export default class MyPlugin extends BasePlugin {

    /** Plugin info */
    static id = "shadegameplugin";
    static name = "Shade Game";

    scores = {};
    answers = {};
    gameId;

    /** Called on load */
    async onLoad() {

        // Register my component
        this.objects.registerComponent(ShadeGameComponent, {
            id: 'shade-game-component',
            name: 'Shade Game Component',
            description: 'Initiates the shading game',
            settings: [
                {
                    id: 'picture',
                    name: 'Picture',
                    type: 'file',
                    help: 'Picture that the users should guess. Leave blank for the default.'
                },
                {
                    id: 'correct-answer',
                    name: 'Superhero',
                    type: 'text',
                    help: 'The superhero that is depicted in the picture'
                },
                {id: 'action-start-game', name: 'Start game', type: 'button'},
                {id: 'action-start-round', name: 'Start round', type: 'button'},
                {id: 'action-stop-round', name: 'Stop round', type: 'button'},
                {id: 'action-remove-all', name: 'Remove All Images', type: 'button'},
            ]
        });

        this.objects.registerComponent(RegisterComponent, {
            id: 'register-shade-game-component',
            name: 'Register in Shade Game Component',
            description: 'Allows user to start participating in the shade game',
        });

        this.objects.registerComponent(OptOutComponent, {
            id: 'opt-out-shade-gaeme-component',
            name: 'Opt out Shade Game Component',
            description: 'Allows user to stop participating in the shade game',
        });

        await this.initialLoad();
    }

    async initialLoad() {
        const instanceId = await this.world.getInstanceID();
        this.gameId = await fetch(`${settings.host}/game-of-room?instanceId=${instanceId}`, {method: 'GET',})
            .then(res => res.json()
                .then(json => json.id));
        this.scores = {};
        if (!this.gameId) {
            return;
        }
        const {scores} = await fetch(`${settings.host}/${this.gameId}/scores`).then(r => r.json());
        for (const score of scores) {
            this.scores[score.userId] = {
                userId: score.userId,
                userDisplayName: score.userDisplayName,
                score: score.score
            }
        }
        await this.registerScoresOverlay();
    }

    async registerScoresOverlay() {
        if (this.scoreOverlayId) {
            return;
        }
        this.scoreOverlayId = await this.menus.register({
            section: 'infopanel',
            panel: {
                iframeURL: this.paths.absolute('scores.html'),
                width: 400,
                height: 100
            }
        });
    }

    async unregisterScoresOverlay() {
        if (this.scoreOverlayId) {
            await this.menus.unregister(this.scoreOverlayId)
        }
        this.scoreOverlayId = undefined;
    }

    async onMessage(data) {
        console.log(`onMessage plugin received: ${JSON.stringify(data)}`);
        switch (data.action) {
            case 'panel-load':
                await this.menus.postMessage({action: 'generate-table', scores: this.scores});
                break;
            case 'score-alert':
                this.menus.alert(null, 'Find the character of the shade to increase your score!');
                break;
            case 'answer':
                await this.addAnswer({answer: data.answer});
                break;
            case 'msg-new-user':
                this.scores[data.newUser.userId] = {
                    userId: data.newUser.userId,
                    userDisplayName: data.newUser.userDisplayName,
                    score: 0
                };
                console.log(`Scores add: ${JSON.stringify(this.scores)}`);
                this.menus.postMessage({action: 'generate-table', scores: this.scores});
                break;
            case 'msg-remove-user':
                delete this.scores[data.userId];
                this.menus.postMessage({action: 'generate-table', scores: this.scores});
                break;
            case 'msg-start-game':
                this.gameId = data.gameId;
                break;
        }
    }

    async addAnswer(data) {
        const userDisplayName = await this.user.getDisplayName();
        this.answers[userDisplayName] = data.answer;
    }
}

class ShadeGameComponent extends BaseComponent {

    async onAction(action) {
        console.log(`onAction ShadeGameComponent received: ${JSON.stringify(action)}`);
        switch (action) {
            case 'action-start-game':
                await this.startGame();
                break;
            case 'action-start-round':
                this.startRound();
                break;
            case 'action-stop-round':
                this.stopRound();
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
        this.plugin.messages.send({action: 'msg-start-game', gameId: this.plugin.gameId}, true);
    }

    startRound() {
        this.plugin.menus.postMessage({action: 'msg-start-round'})
    }

    stopRound() {
        this.updateScores();
        this.plugin.menus.postMessage({action: 'mag-stop-round', })
    }

    updateScores() {
        const correctAnswer = this.getField('correct-answer');
        const answers = Object.entries(this.plugin.answers);

        const unifyString = str => str ? str.toLowerCase().replace(/[ -_]/g, '') : undefined;

        const areEqual = (str1, str2) => str1 && str2 ? levenshtein(unifyString(str1), unifyString(str2)) <= 1 : false;

        for (const answer of answers) {
            if (areEqual(answer[1], correctAnswer)) {
                const user = answer[0];
                this.plugin.scores[user] = this.plugin.scores[user] === undefined ? 0 : this.plugin.scores[user] + 1;
                delete this.plugin.answers[user];
            }
        }
        this.plugin.menus.postMessage({ action: 'generate-table', scores: this.plugin.scores })
    }

    async removeAllImages() {

        const nearbyObjects = await this.plugin.objects.fetchInRadius(this.fields.x || 0, this.fields.y || 0, 500);
        const nearbyImages = nearbyObjects.filter(obj => obj.id.includes(`object:${MyPlugin.id}`));

        // Remove all
        await Promise.all(nearbyImages.map(c => this.plugin.objects.remove(c.id)))

    }
}

class RegisterComponent extends BaseComponent {

    async onClick() {
        await this.plugin.registerScoresOverlay();
        if (!this.plugin.gameId) {
            return;
        }

        const userId = await this.plugin.user.getID();
        if (this.plugin.scores[userId]) {
            return;
        }
        const userDisplayName = await this.plugin.user.getDisplayName();
        const sendMessageP = this.plugin.messages.send({action: 'msg-new-user', newUser: {userId, userDisplayName}}, true);
        await fetch(`${settings.host}/${this.plugin.gameId}/add-user-to-game`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                externalId: userId,
                displayName: userDisplayName
            })
        });
        await sendMessageP;
    }
}

class OptOutComponent extends BaseComponent {

    async onClick() {
        if (!this.plugin.gameId) {
            console.log('There is no active game to opt out from');
            return;
        }

        if (this.plugin.gamePanelId) {
            this.plugin.menus.unregister(this.plugin.gamePanelId);
        }
        this.plugin.gamePanelId = undefined;

        await this.plugin.unregisterScoresOverlay();

        const userId = await this.plugin.user.getID();
        if (!this.plugin.scores[userId]) {
            console.log('The user is not registered');
            return;
        }
        const sendMessageP = this.plugin.messages.send({action: 'msg-remove-user', userId}, true);
        await fetch(`${settings.host}/${this.plugin.gameId}/${userId}/`, {method: 'DELETE'});
        await sendMessageP;
    }
}
