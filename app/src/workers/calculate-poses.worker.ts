
export type BodyPart = {position:{x: number, y: number}, score: number,part: string};
export type CalculateMessage = {
	minScore: number
	value: {keypoints: Array<BodyPart>, score: number}
};

/* eslint-disable no-restricted-globals */
export function CalculatePosesWorker(){

	class CalculatePoses{
		
		private bodyPartsCombinations: {[prop: string]: string[]} = {
			"leftArmpit": ["leftShoulder","leftElbow", 'leftHip'],
			"rightArmpit": ["rightShoulder","rightElbow", 'rightHip'],
			'leftShoulder': ['leftShoulder', 'rightShoulder','leftHip'],
			'rightShoulder': ['rightShoulder', 'leftShoulder','rightHip'],
			'leftElbow': ['leftElbow','leftShoulder','leftWrist'],
			'rightElbow': ['rightElbow','rightShoulder','rightWrist'],
			'leftHip': ['leftHip', 'rightHip','leftShoulder'],
			'rightHip': ['rightHip', 'leftHip','rightShoulder'],
			'leftGroin':['leftHip', 'leftKnee','leftAnkle'],
			'rightGroin':['rightHip', 'rightKnee','rightAnkle'],
			'leftKnee':['leftKnee','leftAnkle','leftHip',],
			'rightKnee':['rightKnee','rightAnkle','rightHip'],
		}
		

		constructor(){
			self.addEventListener('message', ({data})=>this.handleMessage(data));
		}

		private async handleMessage(data: CalculateMessage){
			const partsMap: {[prop: string]: BodyPart} = {};
			const partsCombination = {};
			const msg = data.value;
			msg.keypoints.forEach(element => {
				partsMap[element.part] = element;
			});

			Object.keys(this.bodyPartsCombinations).forEach((key) =>{
				const parts: BodyPart[] = this.bodyPartsCombinations[key].map(element => partsMap[element])
				parts[0]['angle'] = Array.isArray(parts[0]['angle']) ? parts[0]['angle'] : [];
				const partsMeanScore = parts.reduce((prev, curr) => prev + curr.score, 0) / parts.length;
				const angle  = this.calcAngle(
						[parts[0].position.x, parts[0].position.y ], 
						[parts[1].position.x, parts[1].position.y],
						[parts[2].position.x, parts[2].position.y] 
				);
				const value = parseFloat(angle.toFixed(2));
				parts[0]['angle'].push({
					graph: parts.map(p => p.part), 
					meanScore: partsMeanScore,
					value
				});
				partsCombination[key] = {parts};
			})
			
			const leftTop = this.getLine([partsMap.leftShoulder.position.x, partsMap.leftShoulder.position.y],
			[partsMap.leftHip.position.x, partsMap.leftHip.position.y]);

			const leftBottom = this.getLine([partsMap.leftHip.position.x, partsMap.leftHip.position.y],
				[partsMap.leftKnee.position.x, partsMap.leftKnee.position.y]);

			const rightTop = this.getLine([partsMap.rightShoulder.position.x, partsMap.rightShoulder.position.y],
				[partsMap.rightHip.position.x, partsMap.rightHip.position.y]);
			
			const rightBottom = this.getLine([partsMap.rightHip.position.x, partsMap.rightHip.position.y],
					[partsMap.rightKnee.position.x, partsMap.rightKnee.position.y]);

			const ratioAvg = (leftTop/leftBottom + rightTop/rightBottom) / 2;
			
				

			postMessage({parts: partsCombination, ratioAvg,...msg}, null);
		}
		
		calcAngle(coordinate1, coordinate2, coordinate3) {
			const 
				line1_2 = this.getLine(coordinate1, coordinate2),
				line1_3 = this.getLine(coordinate1, coordinate3),
				line2_3 = this.getLine(coordinate2, coordinate3);

			const radians = Math.acos(
				(Math.pow(line1_2,2) + Math.pow(line1_3, 2) - Math.pow(line2_3, 2)) 
				/ (2 * line1_2 * line1_3)
			);
			return (radians * 180) / Math.PI;
		}

		getLine(coor1 : [number, number], coor2: [number, number]){
			const [x1, y1] = coor1,
				  [x2, y2] = coor2
			return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2))
		}
		
	}

	return new CalculatePoses();
}