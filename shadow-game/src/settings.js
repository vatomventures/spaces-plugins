export const settingsProd = {
    host: 'https://xt5jh54nnk.execute-api.us-west-1.amazonaws.com/prod'
};

export const settingsDev = {
    host: 'https://1b5aypw1o3.execute-api.us-west-1.amazonaws.com/dev',
    pictureId: 'object:shadegameplugin:qtexk4nriho'
};

export const settingsLocal = {
    host: 'http://localhost:3000/local',
    pictureId: 'object:shadegameplugin:qtexk4nriho'
};

export const getSettings = () => settingsDev;
