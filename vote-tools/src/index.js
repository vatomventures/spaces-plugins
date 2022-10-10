/**
 * This is the main entry point for your plugin.
 *
 * All information regarding plugin development can be found at
 * https://developer.vatom.com/plugins/plugins/
 *
 * @license MIT
 * @author Vatom Inc.
 */
import {VoteTextComponent} from "./components/VoteTextComponent";
import {getSettings} from "./settings";

const settings = getSettings();

export default class VotePlugin extends BasePlugin {

    /** Plugin info */
    static id = "vote-tools";
    static name = "Vote Tools";

    showTopScores = false;

    async onLoad() {

        await this.objects.registerComponent(VoteTextComponent, {
            id: 'vote-text-component',
            name: 'Increase Vote',
            description: 'Attach voting capabilities to text object',
        });

        if (await this.user.isAdmin()) {
            this.menus.register({
                icon: this.paths.absolute('button-icon.png'),
                text: 'Top Scores',
                action: () => this.topScores()
            });
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

        const instanceId = await this.world.getInstanceID();
        const votes = await fetch(`${settings.host}/vote/${instanceId}/`)
            .then(resp => resp.json())
            .then(json => json.votes);

        await this.messages.send({action: 'msg-panel-load', votes});
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
            case 'msg-panel-load':
                await this.menus.postMessage({action: 'generate-table', votes: data.votes});
                break;
            case 'msg-new-vote':
                await this.objects.update(data.textId, {textValue: data.textValue});
                await this.menus.postMessage({action: 'generate-table', votes: data.votes});
                break;
        }
    }

    async topScores() {
        if (!this.showTopScores) {
            await this.registerScoresOverlay();
            this.showTopScores = true;
        } else {
            await this.unregisterScoresOverlay();
            this.showTopScores = false;
        }
    }
}
