import { IAppConfig } from "../interfaces/action-config.interface";
import * as conf from "./actions"

export const frameTimeMS: number = 150;

export const AppConfig: IAppConfig = {
    ...conf.default,
    "enum":{
        0: 'squat',
        1: 'stand',
        2: 'pushdown',
        3: 'pushup',

    }

}


    