import {getSettings} from "../settings";

const settings = getSettings();

export class OptOutComponent extends BaseComponent {

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
