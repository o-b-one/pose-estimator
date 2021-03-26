export interface IAppConfig{ 
    memorySize?: number;
    actions: {[prop: string]: IActionConfig};
    enum: {
        [_enum:number]: string
    };
};


export interface IActionConfig{
    pattern: string[];
    singularPattern?: string[];
    minRepeats: number;
    enum: number;
    dataset:Array<Array<number>>;
}; 