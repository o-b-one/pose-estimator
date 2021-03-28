/* eslint-disable */
import React, { useState } from 'react';
import Button from '@material-ui/core/Button';
import Slider from '@material-ui/core/Slider';
import Checkbox from '@material-ui/core/Checkbox';
import { FormControlLabel, Select, MenuItem } from '@material-ui/core';
import './pose-estimator.component.scss';

import { Visualizer as PoseVisualizer } from '../../utilities/visualizer.util';
import PoseInfo from '../PoseInfo/PoseInfo';
import { EstimatorService } from '../../services/estimator.service';
import { CalculatePosesWorker } from '../../workers/calculate-poses.worker';
import { ActionEstimatorWorker } from '../../workers/action-estimator.worker';
import { frameTimeMS, AppConfig } from '../../utilities/action-calculator.util';
import { SpeechService } from '../../services/speech.service';
import { IMAGE_MAPPING } from '../../constants/image.mapping';
import { VIDEOS_MAPPING } from '../../constants/video.mapping';

const INIT_STATE = {
  videoSelected: false,
  renderLines: true,
  estimatedAction: null,
  counters: {},
  srcObject: null,
  webcam: null,
  autoMinScore: false,
  loaded: false,
  videoCaptureTimeout: frameTimeMS,
  minScoreToDraw: 0.75
};

export default class PoseEstimator extends React.Component<any, any> {
  static readonly DIMENSIONS = {width: 224, height: 224}
  public readonly picturesToLoad = IMAGE_MAPPING || [];
  public readonly videosToLoad = VIDEOS_MAPPING || [];
  
  
  public autoCalc: boolean = false;
  public showPoseOnlyPreview: boolean = true;
  public overlayPoseVisualizer: PoseVisualizer;
  public previewPoseVisualizer: PoseVisualizer;
  public previewCanvas: React.RefObject<any>;
  public overlayCanvas: React.RefObject<any>;
  public poseOnlyCanvas: React.RefObject<any>;
  public videoPlayer: React.RefObject<any>;
  
  public pose: any = null;
  public minScoreToDraw: number = 0.6;
  public videoSrc: string = null;
  public estimator: EstimatorService = EstimatorService.Provider();
  private _currentImage: any;
  private _calculatorWorker: Worker;
  private _actionEstimatorWorker: Worker;
  private _estimatorWorker: Worker;
  distanceThreshold: { x: number; y: number; };
  interval: NodeJS.Timeout;
  calcRslt: any = {};
  angle: any[];
  promise: Promise<{pose: any, angle: any}>;
  
  constructor(props) {
    super(props);
    this.state = INIT_STATE;
    
    this.estimator.init({inputResolution: PoseEstimator.DIMENSIONS});
    
    this.previewCanvas = React.createRef();
    this.overlayCanvas = React.createRef();
    this.poseOnlyCanvas = React.createRef();
    this.videoPlayer = React.createRef();
  }
  
  render() {
    return (
      <div className="pose-visualizer-page">
      {!this.state.loaded && <section className='loader'>Loading Neural Network...</section>}
      <div className="picture-button-container">
      <Select
      value={''}
      onChange={(ev) => this.loadImageAndRunPosenet(ev.target.value)}
      >
      {
        this.picturesToLoad.map(path => {
          const name = path.split('/').pop()
          return <MenuItem key={name} value={`/img/poses${path}`}>{name}</MenuItem>
        })
      }
      </Select>
      {
        this.videosToLoad.map((videoName, key) => {
          return <Button
          key={key}
          variant="contained"
          color="primary"
          onClick={() => this.loadVideoToCanvasAndRunPosenet(`/video/${videoName}`)}>
          {videoName}
          </Button>
          
        })
      }
      <Button variant="contained"
      color="primary"
      onClick={this.loadWebcamVideoToCanvasAndRunPosenet.bind(this)}>
      Camera</Button>
      <Button variant="contained"
      color="secondary"
      onClick={this.buildDataset.bind(this)}
      >Build dataset</Button>
      </div>
      <div className="pose-display">
      
      <div className="pose-info">
      
      
      <video
      muted
      autoPlay
      {...PoseEstimator.DIMENSIONS}
      style={{ display: this.getProp('videoSelected') ? 'initial' : 'none' }}
      ref={this.videoPlayer}
      controls={true} />
      
      <PoseInfo
      title="Mean accuracy score"
      value={[this.state.pose?.score]}
      />
      <div className="preview-container">
      <div className="preview-interaction">
      <div>{this.state?.hoveredPoint?.part} - {this.state?.hoveredPoint?.score} - Angle: {JSON.stringify(this.state?.hoveredPoint?.angle, null ,2)}</div>
      </div>
      <div className="canvas-container">
      <canvas className="overlay-canvas" ref={this.previewCanvas} 
      {...PoseEstimator.DIMENSIONS}
      ></canvas>
      <canvas className="overlay-canvas" ref={this.overlayCanvas} 
      {...PoseEstimator.DIMENSIONS}
      onMouseDown={this.onCanvasHover.bind(this)}></canvas>
      <canvas ref={this.poseOnlyCanvas} 
      {...PoseEstimator.DIMENSIONS}
      ></canvas>
      </div>
      </div>
      
      
      <div>
      <PoseInfo
      title="Action"
      value={[JSON.stringify(this.state.estimatedAction)]}
      />
      <PoseInfo
      title="Counters"
      value={[JSON.stringify(this.state.counters)]}
      />
    <FormControlLabel
    label="Auto min score"
    control={
      <Checkbox
      onChange={(e) => this.setProp('autoMinScore', e.target.checked)}
      checked={this.state.autoMinScore}
      inputProps={{ 'aria-label': 'autoMinScore:' }}
      />
    } />
    <FormControlLabel
    label="Draw lines"
    control={
      <Checkbox
      onChange={(e) => this.setProp('renderLines', e.target.checked)}
      checked={this.state.renderLines}
      inputProps={{ 'aria-label': 'renderLines:' }}
      />
    } />
    <FormControlLabel
    label="Show detailed score"
    control={
      <Checkbox
      onChange={(e) => this.setProp('showDetailedScore', e.target.checked)}
      checked={this.state.showDetailedScore}
      inputProps={{ 'aria-label': 'showDetailedScore:' }}
      />
    } />
    
    </div>
    <div>
    minScoreToDraw: {this.state.minScoreToDraw}
    <Slider
    onChange={(e, val) => this.setProp('minScoreToDraw', val)}
    value={this.state.minScoreToDraw}
    max={1}
    min={0}
    step={0.05}
    />
    </div>
    <div>
    videoCaptureTimeout: {this.state.videoCaptureTimeout}
    <Slider
    onChange={(e, val) => this.setProp('videoCaptureTimeout', val)}
    value={this.state.videoCaptureTimeout}
    aria-labelledby="discrete-slider"
    valueLabelDisplay="auto"
    step={10}
    marks
    min={0}
    max={2000}
    />
    </div>
    
    {this.state.showDetailedScore && 
      <PoseInfo
      title="Detailed score"
      value={[JSON.stringify(this.state.pose?.parts)]}
      />}
      <div>
      
      </div>
      </div>
      </div>
      </div>
      )
    }
    
    setProp(prop: string, value: any): void {
      this.setState({ ...this.state, ...{ [prop]: value } });
    }
    getProp(prop: string) {
      return this.state[prop];
    }
    
    componentDidMount() {
      this.overlayPoseVisualizer = new PoseVisualizer({ canvas: this.overlayCanvas.current });
      this.previewPoseVisualizer = new PoseVisualizer({ canvas: this.previewCanvas.current });
      
      this.estimator.loadedNotify().then(() => this.setLoader(false));
      if(!this.autoCalc){
        this.setWorkers();
        // this.loadWebcamVideoToCanvasAndRunPosenet();
      }
    }
    
    async buildDataset(){
      this.setLoader(true);
      this.autoCalc = true;
      for (let pic of this.picturesToLoad){
        this.promise = new Promise(res => this.setWorkers(res));
        await this.loadImageAndRunPosenet(`/img/poses${pic}`);
        let res = await this.promise;
        const category = pic.split('/')[1];
        this.calcRslt[category] = this.calcRslt[category] || [];
        
        this.calcRslt[category].push([...res.angle,res.pose.slope,res.pose.verticalPose, res.pose.ratioAvg]);
      }
      
      console.log(this.calcRslt)
      this.autoCalc = false;
      this.setLoader(false);
    }
    
    setWorkers(cb = null){
      // [this._calculatorWorker, this._actionEstimatorWorker, this._estimatorWorker].forEach(worker => worker && worker.terminate());
      const [poseWorker, actionWorker] = this.estimator.registerWorkers(
        {
          worker: CalculatePosesWorker,
          onmessage: this.processPoseEstimation.bind(this)
        },
        {
          worker: ActionEstimatorWorker,
          onmessage: this.processActionEstimation.bind(this)
        }
      );
      this._calculatorWorker = poseWorker;
      this._actionEstimatorWorker = actionWorker;
      this._actionEstimatorWorker.postMessage({type: 'init', config: AppConfig});
      cb && cb({pose: this.pose ,angle:this.angle});
    }

    async processActionEstimation({data}){
      console.log("action set", data);
      if(!data || data.score < .75){
        return;
      }
      console.log(data.action, data.score)
      try{
        if(data.action && data.score >= this.minScoreToDraw){
          this._actionEstimatorWorker.postMessage({type: 'clear'})
          this.setProp('estimatedAction', data);
          let counter = this.state.counters[data.action] || 0 ;
          counter += data.counter;
          const counters =  {...this.state.counters};
          counters[data.action] =  counter;
          this.setProp('counters', counters);
          SpeechService.talk(counter +" " + data.action);
        }else{
          if(data.score >= 0.5){
            SpeechService.talk("Almost there, keep going")
          }
          this.setProp('estimatedAction', {action:"UNKNOWN"});
          
        }
      }catch(e){
        console.log(e);
        debugger;
      }

    }

    async processPoseEstimation({data}){
      this.pose = data;
      this.angle = Object.values(this.pose.parts).map((part) => {
        if ( Array.isArray(part['parts']) && Array.isArray(part['parts'][0].angle)){
          return part['parts'][0].angle[0].value;
        }
      })
      if(!this.autoCalc){
        const result = await this.estimator.classifyAction([...this.angle, this.pose.slope, this.pose.verticalPose, this.pose.ratioAvg]);
        this._actionEstimatorWorker.postMessage({result, type: 'calc'});
      }
      this.setProp('pose', this.pose);
      this.drawPose();
    }
    
    componentWillUnmount(){
      this._calculatorWorker.terminate();
    }
    
    private setLoader(loaderState: boolean){
      this.setProp('loaded', !loaderState);
    }
    
    async loadImage(imagePath): Promise<any> {
      const image = new Image();
      image.src = `${imagePath}`;
      return new Promise((resolve) => {
        image.crossOrigin = '';
        image.onload = () => resolve(image);
      });
    }
    
    onCanvasHover(hoverEvent) {
      this.distanceThreshold = {
        x: this.previewCanvas.current.getBoundingClientRect().x,
        y: this.previewCanvas.current.getBoundingClientRect().y
      }
      const checkIfInPointBoundingBox = ({ mouseLocation, pointLocation }) => {
        return Math.abs((mouseLocation.x - this.distanceThreshold.x)  - pointLocation.x) <= 5
        && Math.abs((mouseLocation.y - this.distanceThreshold.y) - pointLocation.y) <= 5
      }
      
      if (this.pose && this.pose?.keypoints) {
        this.pose.keypoints.forEach((point) => {
          if (
            checkIfInPointBoundingBox({
              pointLocation: point.position,
              mouseLocation: { x: hoverEvent.clientX, y: hoverEvent.clientY }
            })
            ) {
              this.setProp('hoveredPoint', point);
            }
          });
        }
      }
      
      async runPosenetOnCanvas(type?: string) {
        const pose = await this.estimator.estimate(this._currentImage);
        if(!pose) return;
        this._calculatorWorker.postMessage({ value: pose, minScore: this.minScoreToDraw})  
      }
      
      
      drawPose() {
        this.overlayPoseVisualizer.loadPose({keypoints: this.pose.keypoints,score: this.pose.score });
        if (!this.getProp('renderLines')) {
          return;
        }
        this.overlayPoseVisualizer.clearCanvas()
        if (this.getProp('autoMinScore')) {
          this.minScoreToDraw = this.overlayPoseVisualizer.getSmartMinScore();
          this.setProp('minScoreToDraw', this.minScoreToDraw);
        }
        this.overlayPoseVisualizer.drawOverlayOnCanvas({ "minScoreToDraw": this.minScoreToDraw, autoMinScore: this.getProp('autoMinScore'), transparency: null });
        if (this.showPoseOnlyPreview) {
          this.overlayPoseVisualizer.drawOverlayOnCanvas({ transparency: 0.3, minScoreToDraw: this.minScoreToDraw, autoMinScore: this.getProp('autoMinScore') });
        }
      }
      
      cropImage(positions?) {
        const { top, left, width, height } = positions || {};
        this.previewPoseVisualizer.cropImage(left, top, width, height );
      }
      async loadImageToCanvas(imagePath, isVideo = false) {
        let imageElement;
        const positions = {left: 0,top:0,frameWidth:0, frameHeight:0, ...PoseEstimator.DIMENSIONS};
        if(!isVideo){
          this.videoPlayer.current.srcObject = null;
          this.setState({ videoSelected: false });
          imageElement = await this.loadImage(imagePath);
          positions.frameWidth = imageElement.width;
          positions.frameHeight = imageElement.height;
        }
        else{
          imageElement = imagePath
          positions.frameWidth = imageElement.videoWidth;
          positions.frameHeight = imageElement.videoHeight;
          
        }
        this.previewPoseVisualizer.drawImage(positions, imageElement);
        this.setCurrentImage(imageElement);
        
      }
      private setCurrentImage(imageElement) {
        this._currentImage = imageElement;
      }
      async loadImageAndRunPosenet(imagePath) {
        await this.loadImageToCanvas(imagePath);
        await this.runPosenetOnCanvas();
      }
      resizeCanvas({ width, height } = PoseEstimator.DIMENSIONS) {
        const { previewCanvas, overlayCanvas, poseOnlyCanvas } = this;
        if (!(previewCanvas.current && overlayCanvas.current && poseOnlyCanvas.current)) {
          return
        }
        overlayCanvas.current.width = previewCanvas.current.width = width;
        overlayCanvas.current.height = previewCanvas.current.height = height;
        if (this.showPoseOnlyPreview) {
          poseOnlyCanvas.current.width = width;
          poseOnlyCanvas.current.height = height;
        }
      }
      loadWebcamVideoToCanvasAndRunPosenet() {
        navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
          this.videoSrc = null;
          this.setProp('videoSelected', true);
          this.loadVideo(stream);
        })
        .catch(console.error);
      }
      async loadVideoToCanvasAndRunPosenet(videoPath) {
        this.videoSrc = videoPath;
        this.setProp('counters',{});
        this.setProp('estimatedAction',null);
        this.setProp('videoSelected', true);
        this.loadVideo();
      }
      async loadVideo(stream = null) {
        this.videoPlayer.current.srcObject = stream;
        this.videoPlayer.current.src = this.videoSrc;
        let frames = [];
        this.resizeCanvas();
        const drawToCanvasLoop = async () => {
          const isVideoPlaying = (!this.videoPlayer.current.paused && !this.videoPlayer.current.ended);
          if (!isVideoPlaying) {
            return;
          }
          if (this.previewCanvas.current.width === 0 || this.previewCanvas.current.height === 0) {
            this.resizeCanvas({ width: this.videoPlayer.current.videoWidth, height: this.videoPlayer.current.videoHeight });
          }
          // this.previewPoseVisualizer.drawByMemo(this.videoPlayer.current, 200, 200);
          this.loadImageToCanvas(this.videoPlayer.current, true)
          if (isVideoPlaying) {
            this.interval = setTimeout(async () => {
              this.loadImageToCanvas(this.videoPlayer.current, true)
              await this.runPosenetOnCanvas();
              drawToCanvasLoop.call(this)
            }, this.state.videoCaptureTimeout);
          }else{
            this.loadImageToCanvas(this.videoPlayer.current, true)
            await this.runPosenetOnCanvas();

          }
        };
        this.videoPlayer.current.addEventListener('play', drawToCanvasLoop.bind(this));
        this.videoPlayer.current.addEventListener('stop', () => clearTimeout(this.interval));
      }
    }
