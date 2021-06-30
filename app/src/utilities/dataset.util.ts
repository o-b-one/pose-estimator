import { PoseEstimatorService } from "../services/pose-estimator.service"
import { IMAGE_MAPPING } from "../constants/image.mapping"

const poseEstimatorService = PoseEstimatorService.Provider();

export async function  buildDataset(){
  const calcRslt = {};
  for await( const pic of IMAGE_MAPPING) {
    let timeout;
    const category = pic.split('/')[1];
    const posePromise = poseEstimatorService.loadImageAndRunPosenet(`/img/poses${pic}`);
    const timeout$ = new Promise(resolve => timeout = setTimeout(_ => resolve(null), 3_000));
    console.log('wait for', pic);
    let res = await Promise.race(
      [
        timeout$,
        posePromise,
      ]);
    clearTimeout(timeout)
    console.log('result for', pic);

    if(!res){
      continue;
    }
    calcRslt[category] = calcRslt[category] || [];
    calcRslt[category].push([(res as number[])]);
  };
  console.log(calcRslt);
}
