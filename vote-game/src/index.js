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

export default class MyPlugin extends BasePlugin {

    /** Plugin info */
    static id = "vote-game";
    static name = "votegame";

    async onLoad() {

        console.log('Onload');

        await this.objects.registerComponent(VoteTextComponent, {
            id: 'vote-text-component',
            name: 'Increase Vote',
            description: 'Attach voting capabilities to text object',
        });
    }
}
