


export type Dimensions = { width: number, height: number, rotate: number}

export type PoseEstimatorMessage = {
	type: "init"| "estimate", 
	image?: any, 
	payload?:  Dimensions;
};

/* eslint-disable no-restricted-globals */
export function PoseEstimatorWorker(){

	class PoseEstimator{
		private net;
		private yolo;
		
		constructor(){
			self.addEventListener('message', ({data})=>this.handleMessage(data));
		}

		private async handleMessage(data){
			let response;
			switch(data.type){
				case "estimate":
					response = await this.estimate(data.image, data.payload)
					break;
				case "init":
					response = await this.init(data.payload);
					break;
				default:
					return;
			}
			if(response){
				postMessage(response, null);
			}
		}
		
		async init({yolo, posenet, conf}){
			
			this.yolo = await yolo.v3tiny();
			this.net = await posenet.load({
				architecture: 'ResNet50',
				outputStride: 16,
				quantBytes: 4,
				inputResolution: undefined,
				...conf.net
			});
		}

		async estimate(image, payload) {
			
			// this.objectFinder(image, payload);
			return await this.poseEstimator(image, payload);
		}

		async objectFinder(image, payload: Dimensions){
			return await this.yolo.predict(
				image,
				{
				maxBoxes: 2,          // defaults to 20
				scoreThreshold: .5,   // defaults to .5
				iouThreshold: .5,     // defaults to .3
				numClasses: 80,       // defaults to 80 for yolo v3, tiny yolo v2, v3 and 20 for tiny yolo v1
				classNames: ['person'],    // defaults to coco classes for yolo v3, tiny yolo v2, v3 and voc classes for tiny yolo v1
				inputSize: 416,       // defaults to 416
				...payload
				}
			);
		}

		async poseEstimator(image, payload){
			return await this.net.estimateSinglePose(
				image,
				{
				flipHorizontal: false
				});
		}
	}

	return new PoseEstimator();
}