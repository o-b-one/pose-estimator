import * as posenet from '@tensorflow-models/posenet';
import * as knn from '@tensorflow-models/knn-classifier';
import * as tf from '@tensorflow/tfjs';


import yolo from 'tfjs-yolo';
import { Singleton } from '../classses/singleton.class';
import { AppConfig } from '../utilities/action-calculator.util';

export type Dimensions = { width: number, height: number, rotate?: number }

export type PoseEstimatorPayload = {
    image?: any,
} & Partial<posenet.ModelConfig>;

export class EstimatorService extends Singleton<PoseEstimatorPayload>{
    private readonly ROTATE_OPTIONS = [0, 90, 180, 270];
    
    private net;
    private actionClassifier: knn.KNNClassifier;
    private yolo;
    private loaded$: Promise<boolean>;
    private resolver: any;
    
    set loaded(loaded: boolean) {
        this.resolver(loaded);
    };
    
    
    public async init(payload?: PoseEstimatorPayload) {
        
        if(this.loaded$){
            return;
        }
        
        this.loaded$ = new Promise( resolve => this.resolver = resolve);
        const yolo$ = await yolo.v3tiny();
        const net$ = await posenet.load({
            architecture: 'ResNet50',
            outputStride: 16,
            quantBytes: 4,
            inputResolution: undefined,
            ...payload
        });
        // const actionClassifier$ = await tf.loadLayersModel('/model/actions_recognizer/model.json');
        const actionClassifier$ = await knn.create();
        const conf = AppConfig;
        this.actionClassifier = await actionClassifier$;
        Object.keys(conf.actions).forEach(actionString => {
            const action = conf.actions[actionString];
            action.dataset.forEach(ds => this.actionClassifier.addExample(tf.tensor1d(ds), actionString));
        })
        
        await Promise.all([yolo$, net$])
        .then(([yolo, net]) => { 
            this.yolo = yolo;
            this.net = net;
            
        })
        this.loaded = true;
    }
    
    
    loadedNotify() {
        return this.loaded$;
    }
    
    async estimate(image, payload = {}) {
        const date = new Date();
        await this.loadedNotify();
        // const result = await this.objectFinder(image);
        // if (result.length > 0) {
        //     const { left, top, width, height } = result[0];
        //     const tfImage = tf.browser.fromPixels(image);
        //     image = tf.tidy(() => {
        
        //         return this.preprocessImage(tfImage);
        //     })
        //     image = await tf.browser.toPixels(image);
        // }
        const [pose] = await Promise.all([this.poseEstimator(image, payload)]);
        if(pose){
            pose.estimationTime = date.getTime();
        }
        return pose
    }
    
    async classifyAction(angles: number[]) {
        await this.loadedNotify();
        
        const prediction = await this.actionClassifier.predictClass(tf.tensor1d(angles));
        return {action: prediction.label, classIndex: prediction.classIndex, confidenceLevel: prediction.confidences[prediction.label] };
    }
    
    // async classifyAction(frame) {
    //     await this.loadedNotify();
    //     const tensor = this.preprocessImage(frame);
    //     const prediction = await this.actionClassifier.predict(tf.reshape(tensor, [1, ...tensor.shape]), {batchSize: 1});
    //     return (prediction as any).dataSync().findIndex(i => !!i);
    // }
    
    preprocessImage(image: any, dimensions: Dimensions = {width: 224, height: 224}){
        const tensor = tf.browser.fromPixels(image)
        return tensor.resizeBilinear([dimensions.width,dimensions.height]);
    }
    
    getFrameAsImage(frame) {
        let image = tf.browser.fromPixels(frame, 3);
        return tf.image.resizeBilinear(image, [224, 224])
    }
    
    private async objectFinder(image, payload?: Dimensions) {
        return await this.yolo.predict(
            image,
            {
                maxBoxes: 1,          // defaults to 20
                scoreThreshold: .5,   // defaults to .5
                iouThreshold: .5,     // defaults to .3
                numClasses: 80,       // defaults to 80 for yolo v3, tiny yolo v2, v3 and 20 for tiny yolo v1
                classNames: ['person'],    // defaults to coco classes for yolo v3, tiny yolo v2, v3 and voc classes for tiny yolo v1
                inputSize: 416,       // defaults to 416
                ...payload
            }
            );
        }
        
        private async poseEstimator(image, payload) {
            return await this.net.estimateSinglePose(
                image,
                {
                    flipHorizontal: false
                }
                ).then(result =>{
                    if(result.score < 0.75){
                        return
                    }
                    result.slope = Math.min(...this.calcSlopes(result.keypoints));
                    result.verticalPose = this.isVertical(result.slope) ? 1000 : -1000;
                    return result;
                });
            }
            
            calcSlopes(keypoints: any): any {
                const parts = {};
                for(const keypoint of keypoints){
                    const part = keypoint.part.toLowerCase().split(new RegExp('left|right')).pop()
                    if(!(parts[part] && parts[part].score > keypoint.score)){
                        parts[part] = {score: keypoint.score, position: keypoint.position}
                    }
                }
                const shoulderSlope = Math.abs((parts['shoulder'].position.y - parts['knee'].position.y) 
                / (parts['shoulder'].position.x - parts['knee'].position.x));
                const hipSlope = Math.abs((parts['hip'].position.y - parts['knee'].position.y) 
                / (parts['hip'].position.x - parts['knee'].position.x));
                return [hipSlope, shoulderSlope]
                
            }
            
            /**
            * 
            * @param slope 
            * @param treshold in radian - 0.87 = 60 deg
            */
            isVertical(slope: number, treshold: number = 0.87){
                return Math.atan(slope) > treshold;
            }
        }