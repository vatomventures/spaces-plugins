import {getSettings} from "../settings";

const settings = getSettings();

export class VoteTopVotesComponent extends BaseComponent {
    async onLoad() {
        await this.removeAllVotes()
            .catch(e => console.log(`remove all votes error: ${JSON.stringify(e)}`));
        await this.createScore()
            .catch(e => console.log(`create score error: ${JSON.stringify(e)}`));
    }

    async onClick() {

    }

    async createScore() {
        return this.plugin.objects.create({
            name: `object:${this.plugin.id}:vote:superman`,
            type: 'text',
            parent: '5404aa89-66e1-4a87-a03c-84ee3ab82fa3',
            transparent: true,
            scale: 0.5,
            // x: (this.fields.x - 0.01 || 0),
            // y: (this.fields.y || 0),
            // height: (this.fields.height) || 0,
            // rotation_x: 1.57,
            // rotation_y: (this.fields.rotation_y || 0),
            // rotation_z: 1.57,
            clientOnly: false,
            textValue: 'superman',
        });
    }

    async removeAllVotes() {

        console.log(`properties ${JSON.stringify(await this.plugin.objects.get('5404aa89-66e1-4a87-a03c-84ee3ab82fa3'))}`);
        const nearbyObjects = await this.plugin.objects.fetchInRadius(this.fields.x || 0, this.fields.y || 0, 10000);
        console.log(`many obje ${nearbyObjects.map(o => `name: ${o.name}, id: ${o.id}`)}`);
        const nearbyTopVotes = nearbyObjects.filter(obj => obj.name && obj.name.includes(`object:${this.plugin.id}:vote:`));

        // Remove all
        await Promise.all(nearbyTopVotes.map(o => this.plugin.objects.remove(o.id)))

    }
}
