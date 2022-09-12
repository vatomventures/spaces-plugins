/**
 * This is the main entry point for your plugin.
 *
 * All information regarding plugin development can be found at
 * https://developer.vatom.com/plugins/plugins/
 *
 * @license MIT
 * @author Vatom Inc.
 */
export default class MyPlugin extends BasePlugin {

    /** Plugin info */
    static id = "hyperbeam";
    static name = "Hyberbeam";

    clicked = false;

    /** Called on load */
    onLoad() {

        // Create a button in the toolbar
        this.menus.register({
            icon: this.paths.absolute('button-icon.png'),
            text: 'Hyperbeam',
            action: () => this.onButtonPress()
        })

    }

    /** Called when the user presses the action button */
    async onButtonPress() {

        if (!this.clicked) {
            this.browserOverlay = await this.menus.register({
                section: 'overlay-top',
                panel: {
                    iframeURL: this.paths.absolute('browser.html'),
                    width: 1000,
                    height: 550
                }
            });
        } else {
            await this.menus.unregister(this.browserOverlay)
        }
        this.clicked = !this.clicked;
        console.log(this.clicked);
    }

}
