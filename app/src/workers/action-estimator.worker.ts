import { IAppConfig, IActionConfig } from "../interfaces/action-config.interface";


/* eslint-disable no-restricted-globals */
export function ActionEstimatorWorker(){
	
	class ActionEstimator{
		private static readonly INIT_GUESS = {action: null, score: 0, counter:0 };
		private static readonly MAX_STATIC_ACTIONS = 10;

		private _memorySize: number = 20;
		private _previousActions: string[] = [];
		private _actions: {[prop: string]: IActionConfig};
		private _dictionary: {[_enum: number]: string};
		private _lastGuess: {score: number, counter: number, action: string} = {...ActionEstimator.INIT_GUESS};
		private _iterationSinceChanged: number = 0;
		
		constructor(){
			self.addEventListener('message', ({data})=>this.handleMessage(data));
		}
		
		public init(configuration: IAppConfig){
			this._memorySize = configuration.memorySize || this._memorySize;
			this._actions = configuration.actions;
			for(let key in this._actions){
				this._actions[key].singularPattern = [...this._actions[key].pattern];
				for (let i = 1; i < this._actions[key].minRepeats; i++){
					this._actions[key].pattern.push.apply(this._actions[key].pattern, this._actions[key].singularPattern)
				}
			}
			this._dictionary = configuration.enum;
		}
		
		estimateAction(actionString: string, confidenceLevel: number){
			console.log("pose action to process",actionString, confidenceLevel);
			if(!confidenceLevel){
				return;
			}
			let _lastGuess, improved = false;
			if(actionString && this._previousActions[this._previousActions.length - 1] !== actionString){
				this._previousActions.push(actionString);
				let counter;
				for (let key in this._actions){
					let similar, counterTemp;
					[similar, counterTemp] = this.getSimilarityScore(this._actions[key]);
					improved = this.handleImprovement(similar, counter, key, this._actions[key]);
					if(improved){
						counter = counterTemp;
					}
				}
				_lastGuess = {...this._lastGuess, counter};
			}
			if(this._shouldInit()){
				this._initGuess();
			}
			console.log(
				'improved: ', improved,
				'prediction: ', actionString, 
				'actions: ', this._previousActions.join()
			);
			return _lastGuess;
		}
		
		private _shouldInit(): boolean {
			return this._iterationSinceChanged > ActionEstimator.MAX_STATIC_ACTIONS || 
				this._previousActions.length === this._memorySize || 
				this._lastGuess.score >= .75;
		}
		
		private handleImprovement(similarityScore: number, counter: number, actionString: string, action: IActionConfig): boolean{
			const score = similarityScore / action.pattern.length;
			if(score > this._lastGuess.score){
				this._lastGuess.score = score;
				this._lastGuess.counter = counter;
				this._lastGuess.action = actionString;
				this._iterationSinceChanged = 0;
				return true;
			}else{
				this._iterationSinceChanged++
				return false
			}
		}
		
		private getSimilarityScore(action: IActionConfig, reverse = false): [number, number]{
			let score = 0, counter = 0;
			const pattern = action.pattern;
			let pActions =  this._previousActions.filter(paction => action.singularPattern.includes(paction))
			pActions = reverse ? pActions.reverse() : pActions;
			if(pActions.length > 0){
				for (let index = 0 ; index < pActions.length;  index++){
					if(pattern.length > index && pActions[index] !== pattern[index]){
						break
					}
					score++;			
				}
				const patternString = action.singularPattern.join('');
				let actionsString = pActions.join('');
				let index = actionsString.indexOf(patternString);
				while(index !== -1 && index < actionsString.length){
					counter++;
					actionsString = actionsString.slice(index + patternString.length);
					index = actionsString.indexOf(patternString);
				}
				if(!reverse){
					const [rScore, rCounter] = this.getSimilarityScore(action, true);
					if(rScore > score){
						score = rScore;
						counter = rCounter;
					}
				}
			}
			return [score, counter];
		}
		
		private _initGuess(){
			this._lastGuess = {...ActionEstimator.INIT_GUESS};
			this._previousActions = [];
			this._iterationSinceChanged = 0;
		}
		
		private async handleMessage(data: {type:"init"|"calc"|"clear", config: IAppConfig, result:{action: string, confidenceLevel: number}}){
			switch(data.type){
				case 'clear':
					this._initGuess()
					break
				case 'calc':
					const result = this.estimateAction(data.result.action, data.result.confidenceLevel);
					// if(result && result.counter){
						postMessage(result, null)
					// }
					break
				case 'init':
					this.init(data.config);
					break;
				default:
					console.log("unknown", data)
					break
			}
		}
			
			
	}
		
	return new ActionEstimator();
}