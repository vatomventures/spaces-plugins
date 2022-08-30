import {settingsLocal} from "./settings";

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

const settings = settingsLocal;

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

        const userId = await this.user.getID();
        if(this.scores[userId]) {
            await this.registerScoresOverlay();
            await this.registerInputOverlay();
        }
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

    async registerInputOverlay() {
        if (this.inputOverlay) {
            return;
        }
        this.inputOverlay = await this.menus.register({
            section: 'overlay-top',
            panel: {
                iframeURL: this.paths.absolute('input.html'),
                width: 300,
                height: 100
            }
        });
    }

    async unregisterInputOverlay() {
        if (this.inputOverlay) {
            await this.menus.unregister(this.inputOverlay)
        }
        this.inputOverlay = undefined;
    }

    async onMessage(data) {
        console.log(`onMessage plugin received: ${JSON.stringify(data)}`);
        switch (data.action) {
            case 'msg-panel-load':
                await this.menus.postMessage({action: 'generate-table', scores: this.scores});
                break;
            case 'msg-score-alert':
                this.menus.alert(null, 'Find the character of the shade to increase your score!');
                break;
            case 'msg-answer':
                await this.addAnswer({answer: data.answer});
                break;
            case 'msg-game-master-answer':
                this.answers[data.userId] = data.answer.answer;
                break;
            case 'msg-new-user':
                this.scores[data.newUser.userId] = {
                    userId: data.newUser.userId,
                    userDisplayName: data.newUser.userDisplayName,
                    score: data.newUser.score
                };
                this.menus.postMessage({action: 'generate-table', scores: this.scores});
                break;
            case 'msg-new-scores':
                this.scores = data.score;
                this.menus.postMessage({action: 'generate-table', scores: this.scores});
                break;
            case 'msg-remove-user':
                delete this.scores[data.userId];
                this.menus.postMessage({action: 'generate-table', scores: this.scores});
                break;
            case 'msg-start-game':
                this.gameId = data.gameId;
                this.gameMasterId = data.gameMasterId;
                break;
            case 'msg-start-round':
                await this.menus.postMessage({action: 'start-round'});
                break;
            case 'msg-stop-round':
                this.scores = data.scores;
                this.menus.postMessage({action: 'generate-table', scores: this.scores});
                await this.menus.postMessage({action: 'stop-round'});
                break;
        }
    }

    async addAnswer(answer) {
        const userId = await this.user.getID();
        await this.messages.send({action: 'msg-game-master-answer', userId, answer}, false, this.gameMasterId);
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
        const nearbyImages = nearbyObjects.filter(obj => obj.id.includes(`object:${MyPlugin.id}`));

        // Remove all
        await Promise.all(nearbyImages.map(c => this.plugin.objects.remove(c.id)))

    }
}

class RegisterComponent extends BaseComponent {

    async onClick() {
        await this.plugin.registerScoresOverlay();
        await this.plugin.registerInputOverlay();
        if (!this.plugin.gameId) {
            return;
        }

        const userId = await this.plugin.user.getID();
        if (!this.plugin.scores[userId]) {
            const userDisplayName = await this.plugin.user.getDisplayName();
            const newUser = await fetch(`${settings.host}/${this.plugin.gameId}/add-user-to-game`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    externalId: userId,
                    displayName: userDisplayName,
                    role: 2,
                    status: 1
                })
            }).then(r => r.json());
            await this.plugin.messages.send({
                action: 'msg-new-user',
                newUser: {userId, userDisplayName, score: newUser.score}
            }, true);
        }
        if (!this.plugin.gameMasterId) {
            await fetch(`${settings.host}/${this.plugin.gameId}/game-master`).then(r => r.json())
                .then(json => this.plugin.gameMasterId = json.gameMasterId);
        }
    }
}

class OptOutComponent extends BaseComponent {

    async onClick() {
        if (!this.plugin.gameId) {
            console.log('There is no active game to opt out from');
            return;
        }

        await this.plugin.unregisterScoresOverlay();
        await this.plugin.unregisterInputOverlay();

        const userId = await this.plugin.user.getID();
        if (!this.plugin.scores[userId]) {
            console.log('The user is not registered');
            return;
        }
        const sendMessageP = this.plugin.messages.send({action: 'msg-remove-user', userId}, true);
        await fetch(`${settings.host}/${this.plugin.gameId}/add-user-to-game`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                externalId: userId,
                status: 2
            })
        });
        await sendMessageP;
    }
}
