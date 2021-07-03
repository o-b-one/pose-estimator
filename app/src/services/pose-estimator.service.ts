import { Singleton } from "../classses/singleton.class";
import { EstimatorService } from "../services/estimator.service";
import { AppConfig } from "../utilities/action-calculator.util";
import { ActionEstimatorWorker } from "../workers/action-estimator.worker";
import { CalculatePosesWorker } from "../workers/calculate-poses.worker";
import { Visualizer } from '../utilities/visualizer.util';



interface PoseEstimatorPayload{
    previewPoseVisualizer: Visualizer;
};

export class PoseEstimatorService extends Singleton<PoseEstimatorPayload>{
    public static readonly DIMENSIONS = Object.freeze({width: 224, height: 224});
    public static readonly TIMEOUT_MS = 0.3 * 1000;
    previewPoseVisualizer: Visualizer;
    
    private estimator = EstimatorService.Provider({});
    private calculatorWorker: Worker;
    private _currentImage: any;
    private actionEstimatorWorker: any;

    private actionsCallbacks: Array<(data: any) => unknown> = [];
    private posesCallbacks: Array<(data: any) => unknown> = [];
    private ready: boolean = false;
    posePromise: {resolve: (data: any) => void, promise: Promise<any> } = {} as any;

    constructor() {
        super();
        this.estimator.init();
        this.setWorkers();
        this.loadedNotify().then(_ => this.ready = true);
    }
    
    
    
    public init(payload: PoseEstimatorPayload){
        this.previewPoseVisualizer = payload.previewPoseVisualizer;
    }

    public async loadImageAndRunPosenet(imagePath, isVideo: boolean) {
        await this.loadImageToCanvas(imagePath, isVideo);
        await this.runPosenetOnCanvas();
        return this.posePromise.promise;
    }

    /**
     * Proxy to get min score from the estimator itself
     */
    public getMinScore(): number{
        return this.estimator.getMinScore();
    }

    /**
     * Proxy to set the min score on the estimator itself
     */
    public setMinScore(minScore: number): void{
        this.estimator.setMinScore(minScore);
    }

    public onPoseEstimation(cb: (data) => unknown): void {
        this.posesCallbacks.push(cb);
    }

    public onActionEstimation(cb: (data) => unknown): void {
        this.actionsCallbacks.push(cb);
    }

    public loadedNotify(): Promise<unknown>{
        return this.estimator.loadedNotify();
    }

    public async loadImageToCanvas(imagePath: string, isVideo: boolean = false) {
        if(!this.ready){
            return;
        }
        let resolve;
        this.posePromise.promise = Promise.race( [
            new Promise(res => resolve = res), 
            new Promise(res => setTimeout(() => res(null), PoseEstimatorService.TIMEOUT_MS))
        ]);
        this.posePromise.resolve = resolve;
        let imageElement;
        const positions = {left: 0,top:0,frameWidth:0, frameHeight:0, ...PoseEstimatorService.DIMENSIONS};
        if(!isVideo){
          imageElement = await this.loadImage(imagePath);
          positions.frameWidth = imageElement.width;
          positions.frameHeight = imageElement.height;
        }
        else{
          imageElement = await Promise.resolve(imagePath)
          positions.frameWidth = imageElement.videoWidth;
          positions.frameHeight = imageElement.videoHeight;
          
        }
        this.previewPoseVisualizer.drawImage(positions, imageElement);
        this.setCurrentImage(imageElement);
    }

    public clearActionEstimationQueue(){
        this.actionEstimatorWorker.postMessage({type: 'clear'})
    }


// ###### PRIVATE METHODS ###### 


    private setWorkers(){
        // [this.calculatorWorker, this.actionEstimatorWorker, this._estimatorWorker].forEach(worker => worker && worker.terminate());
        const [poseWorker, actionWorker] = this.estimator.registerWorkers(
          {
            worker: CalculatePosesWorker,
            onmessage: this.dispatchPoseEstimation.bind(this)
          },
          {
            worker: ActionEstimatorWorker,
            onmessage: this.dispatchActionEstimation.bind(this)
          }
        );
        this.calculatorWorker = poseWorker;
        this.actionEstimatorWorker = actionWorker;
        this.actionEstimatorWorker.postMessage({type: 'init', config: AppConfig});
    }

    private async dispatchPoseEstimation(msg: {data: any}) {
        const angle = Object.values(msg.data.parts).reduce((arr: any[], part: any) => {
            if ( Array.isArray(part['parts']) && Array.isArray(part['parts'][0].angle)){
                arr.push(part['parts'][0].angle[0].value);
            }
            return arr;
        }, []) as any[];
        this.posesCallbacks.forEach(cb => cb({pose: msg.data, angle}));
        const poseData = [...angle, msg.data.slope, msg.data.verticalPose, msg.data.ratioAvg];
        const result = await this.estimator.classifyAction(poseData);
        this.actionEstimatorWorker.postMessage({result, type: 'calc'});
        this.posePromise.resolve(poseData);
    }

    private dispatchActionEstimation(msg: {data: any}): void{
        this.actionsCallbacks.forEach(cb => cb(msg.data));
    }
  
    private loadImage(imagePath): Promise<any> {
        const image = new Image();
        image.src = `${imagePath}`;
        return new Promise((resolve) => {
          image.crossOrigin = '';
          image.onload = () => resolve(image);
        });
    }

    private async runPosenetOnCanvas(type?: string) {
        const pose = await this.estimator.estimate(this._currentImage);
        if(!pose) return;
        this.calculatorWorker.postMessage({ value: pose, minScore: this.getMinScore()})
    }
      

    private setCurrentImage(imageElement) {
        this._currentImage = imageElement;
    }

    private getCurrentImage() {
        return this._currentImage;
    }
      
}