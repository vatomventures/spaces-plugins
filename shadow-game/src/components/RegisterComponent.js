import {getSettings} from "../settings";

const settings = getSettings();

export class RegisterComponent extends BaseComponent {

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
