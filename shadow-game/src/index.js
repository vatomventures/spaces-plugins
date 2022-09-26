import {getSettings} from "./settings";
import {ShadeGameComponent} from "./components/ShadeGameComponent";
import {RegisterComponent} from "./components/RegisterComponent";
import {OptOutComponent} from "./components/OptOutComponent";

/**
 * This is the main entry point for your plugin.
 *
 * All information regarding plugin development can be found at
 * https://developer.vatom.com/plugins/plugins/
 *
 * @license MIT
 * @author Vatom Inc.
 */

const settings = getSettings();
export const MAX_ROUNDS = 6;
export const MAXCOUNTDOWNSECONDS = 3;

export default class ShadeGamePlugin extends BasePlugin {

    /** Plugin info */
    static id = "shadegameplugin";
    static name = "Shade Game";

    scores = {};
    answers = {};
    gameId;
    gameMasterId;

    /** Called on load */
    async onLoad() {

        // Register my component
        this.objects.registerComponent(ShadeGameComponent, {
            id: 'shade-game-component',
            name: 'Shade Game Component',
            description: 'Initiates the shading game',
            settings: [
                ...(this.generateAnswerPairs()),
                {id: 'action-start-game', name: 'Start game', type: 'button'},
                {id: 'action-start-round', name: 'Start round', type: 'button'},
                {id: 'action-stop-round', name: 'Stop round', type: 'button'},
                {id: 'action-end-game', name: 'End game', type: 'button'},
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

    generateAnswerPairs() {
        const answerPairs = [];
        for (let i = 1; i <= MAX_ROUNDS; i++) {
            answerPairs.push({
                id: `picture${i}`,
                name: `Picture ${i}`,
                type: 'text',
                help: 'Picture that the users should guess. Leave blank for skipping this round.'
            });
            answerPairs.push({
                id: `correct-answer${i}`,
                name: `Correct Answer ${i}`,
                type: 'text',
                help: 'The superhero that is depicted in the picture'
            });
        }
        return answerPairs;
    }

    async initialLoad() {

        await this.menus.register({
            section: 'plugin-settings',
            panel: {
                fields: [
                    { id: 'imageScreenId', name: 'Picture Id', help: 'Enter the id of the image object where the pictures will be shown', type: 'text' },
                    { id: 'countdownId', name: 'Countdown Id', help: 'Enter the id of the countdown object where the countdown timer will be shown', type: 'text' }
                ]
            }
        });

        await this.objects.update(this.pictureId, {url: this.paths.absolute('gameToStart.png')}, false);

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

        if (!this.gameMasterId) {
            await fetch(`${settings.host}/${this.gameId}/game-master`).then(r => r.json())
                .then(json => this.gameMasterId = json.gameMasterId);
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
                await this.registerScoresOverlay();
                this.menus.postMessage({action: 'generate-table', scores: this.scores});
                break;
            case 'msg-start-round':
                await this.menus.postMessage({action: 'start-round'});
                break;
            case 'msg-stop-round':
                this.scores = data.scores;
                this.menus.postMessage({action: 'generate-table', scores: this.scores});
                await this.menus.postMessage({action: 'stop-round'});
                break;
            case 'msg-end-game':
                await this.endGame();
                break;
        }
    }

    async endGame() {
        const changeUserStatusRequests = Object.values(this.scores)
            .map(score => fetch(`${settings.host}/${this.gameId}/add-user-to-game`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    externalId: score.userId,
                    status: 2
                })
            }));
        await Promise.all(changeUserStatusRequests);
        this.scores = {};
        this.answers = {};
        this.gameMasterId = undefined;
        this.gameId = undefined;
        this.menus.postMessage({action: 'generate-table', scores: this.scores});
        await this.unregisterInputOverlay();
        await this.unregisterScoresOverlay()
    }

    async addAnswer(answer) {
        const userId = await this.user.getID();
        await this.messages.send({action: 'msg-game-master-answer', userId, answer}, false, this.gameMasterId);
    }
}
