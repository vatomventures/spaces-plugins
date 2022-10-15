import {getSettings} from "../settings";

const settings = getSettings();

export class VoteTextComponent extends BaseComponent {
    async onLoad() {
        const instanceId = await this.plugin.world.getInstanceID();
        await this.updateTextValue(instanceId);
    }

    async onClick() {
        const text = (() => {
            const textValue = this.fields.textValue;
            if (!this.getTotalVotesRegExp().test(textValue)) {
                return textValue;
            } else {
                return textValue.substring(0, textValue.lastIndexOf('('))
            }
        })();
        await this.plugin.menus.toast({
            text: `Are you sure you want to vote for ${text}`,
            textColor: '#2DCA8C',
            buttonColor: '#FFFFFF',
            buttonText: 'Vote',
            buttonAction: this.onSuccessFullClick.bind(this),
            buttonCancelText: 'Cancel',
            buttonCancelAction: () => null,
            duration: 150000
        });
    }

    async onSuccessFullClick() {
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
            this.updateTextValue(instanceId);
            this.plugin.menus.alert('You voted!', 'Success', 'success');
        } else {
            await this.plugin.menus.alert('Please try after 12am PT', 'Not enough time has passed', 'warning');
        }
    }

    async updateTextValue(instanceId) {
        // textValue need to be in 'value (total_votes)' format in order to update it.
        if (!this.getTotalVotesRegExp().test(this.fields.textValue)) {
            return;
        }

        const count = await fetch(`${settings.host}/vote/${instanceId}/${this.fields.name}`)
            .then(resp => resp.json())
            .then(json => json.count);
        const text = this.fields.textValue.substring(0, this.fields.textValue.lastIndexOf('('));
        const textValue = `${text}(${count})`;
        await this.plugin.messages.send({action: 'msg-new-vote', textId: this.objectID, textValue}, true);
    }

    getTotalVotesRegExp() {
        return new RegExp('^.*\\(\\d+|undefined\\)$');
    }
}
