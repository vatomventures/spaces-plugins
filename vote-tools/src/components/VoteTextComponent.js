import {getSettings} from "../settings";

const settings = getSettings();

export class VoteTextComponent extends BaseComponent {
    async onLoad() {
        const instanceId = await this.plugin.world.getInstanceID();
        await this.updateTextValue(instanceId);
    }

    async onClick() {
        const instanceId = await this.plugin.world.getInstanceID();
        const resp = await fetch(`${settings.host}/vote/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instanceId,
                value: this.fields.name,
                userId: await this.plugin.user.getID()
            })
        });

        if (resp.status === 200) {
            await this.updateTextValue(instanceId);
        }
    }

    async updateTextValue(instanceId) {
        const regex = new RegExp('^.*\\(\\d*.|undefined\\)$');
        // textValue need to be in 'value (total_votes)' format in order to update it.
        if (!regex.test(this.fields.textValue)) {
            return;
        }

        const count = await fetch(`${settings.host}/vote/${instanceId}/${this.fields.name}`)
            .then(resp => resp.json())
            .then(json => json.count);
        const text = this.fields.textValue.substring(0, this.fields.textValue.lastIndexOf('('));
        const textValue = `${text}(${count})`;
        await this.plugin.messages.send({action: 'msg-new-vote', textId: this.objectID, textValue}, true);
    }
}
