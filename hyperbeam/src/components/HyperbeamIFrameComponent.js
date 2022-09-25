import {getSettings} from "../settings";

const settings = getSettings();

export class HyperbeamIFrameComponent extends BaseComponent {

    async onLoad() {
        const embedUrl = await fetch(`${settings.host}/hyperbeam`)
            .then(resp => resp.json())
            .then(json => json.embed_url);

        await this.plugin.objects.update(this.objectID, {"component:web-frame:web-frame:url": embedUrl});
    }
}
