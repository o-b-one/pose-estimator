/* eslint-disable */
import React, { useState } from 'react';
import Button from '@material-ui/core/Button';
import Slider from '@material-ui/core/Slider';
import Checkbox from '@material-ui/core/Checkbox';
import { FormControlLabel, Select, MenuItem } from '@material-ui/core';
import './pose-estimator.component.scss';

import { Visualizer as PoseVisualizer } from '../../utilities/visualizer.util';
import PoseInfo from '../PoseInfo/PoseInfo';
import { frameTimeMS } from '../../utilities/action-calculator.util';
import { SpeechService } from '../../services/speech.service';
import { IMAGE_MAPPING } from '../../constants/image.mapping';
import { VIDEOS_MAPPING } from '../../constants/video.mapping';
import { PoseEstimatorService } from '../../services/pose-estimator.service';

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
  minScoreToDraw: 0.75,
  pose: null,
  hoveredPoint: null,
  showDetailedScore: false
};

export default class PoseEstimator extends React.Component<any, any> {
  static readonly DIMENSIONS = PoseEstimatorService.DIMENSIONS;
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
  public videoSrc: string = null;
  public poseEstimatorService = PoseEstimatorService.Provider();
  distanceThreshold: { x: number; y: number; };
  interval: NodeJS.Timeout;
  calcRslt: any = {};
  angle: any[];
  
  constructor(props) {
    super(props);   
    
    INIT_STATE.minScoreToDraw = this.poseEstimatorService.getMinScore();
    this.state = INIT_STATE;
    
    this.previewCanvas = React.createRef();
    this.overlayCanvas = React.createRef();
    this.poseOnlyCanvas = React.createRef();
    this.videoPlayer = React.createRef();
  }
  
  
  setProp(prop: keyof typeof INIT_STATE, value: any): void {
    this.setState({ ...this.state, ...{ [prop]: value } });
  }

  getProp(prop: keyof typeof INIT_STATE) {
    return this.state[prop];
  }
  
  componentDidMount() {
    this.overlayPoseVisualizer = new PoseVisualizer({ canvas: this.overlayCanvas.current });
    this.previewPoseVisualizer = new PoseVisualizer({ canvas: this.previewCanvas.current });
    this.poseEstimatorService.init({
      videoPlayer: this.videoPlayer,
      previewPoseVisualizer: this.previewPoseVisualizer,
    }); 
    this.poseEstimatorService.loadedNotify().then(() => this.setLoader(false));
    this.poseEstimatorService.onPoseEstimation(this.processPoseEstimation.bind(this));
    this.poseEstimatorService.onActionEstimation(this.processActionEstimation.bind(this));
  }
    
    async processActionEstimation(data){
      console.log("action set", data);
      if(data?.action && data?.score >= this.getProp('minScoreToDraw')){
        this.poseEstimatorService.clearActionEstimationQueue();
        this.setProp('estimatedAction', data);
        let counter = this.state.counters[data.action] || 0 ;
        counter += data.counter;
        const counters =  {...this.state.counters};
        counters[data.action] =  counter;
        this.setProp('counters', counters);
        SpeechService.talk([counter, data.action].join(' '));
      }else if(data?.score >= 0.5 && this.getProp('estimatedAction') !== 'UNKONWN'){
        SpeechService.talk("Almost there, keep going")
        this.setProp('estimatedAction', {action:"UNKNOWN"});
      }
    }
    
    async processPoseEstimation(data){
      this.pose = data.pose;
      this.angle = data.angle;
      this.setProp('pose', this.pose);
      this.drawPose();
    }
    
    private setLoader(loaderState: boolean){
      this.setProp('loaded', !loaderState);
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
      

    setMinScore(minScore: number): void{
      this.poseEstimatorService.setMinScore(minScore);
      this.setProp('minScoreToDraw', minScore);
    }
      
      
    drawPose() {
      this.overlayPoseVisualizer.loadPose({keypoints: this.pose.keypoints,score: this.pose.score });
      if (!this.getProp('renderLines')) {
        return;
      }
      this.overlayPoseVisualizer.clearCanvas()
      if (this.getProp('autoMinScore')) {
        const minScoreToDraw = this.overlayPoseVisualizer.getSmartMinScore();
        this.setMinScore(minScoreToDraw); 
      }
      this.overlayPoseVisualizer.drawOverlayOnCanvas({ "minScoreToDraw": this.getProp('minScoreToDraw'), autoMinScore: this.getProp('autoMinScore'), transparency: null });
      if (this.showPoseOnlyPreview) {
        this.overlayPoseVisualizer.drawOverlayOnCanvas({ transparency: 0.3, minScoreToDraw: this.getProp('minScoreToDraw'), autoMinScore: this.getProp('autoMinScore') });
      }
    }
      
    cropImage(positions?: {top: number, left: number, width: number, height: number}) {
      const { top, left, width, height } = positions || {};
      this.previewPoseVisualizer.cropImage(left, top, width, height );
    }
      
    async loadImageAndRunPosenet(imagePath) {
      this.videoPlayer.current.srcObject = null;
      await this.poseEstimatorService.loadImageAndRunPosenet(imagePath);
    }
      
    resizeCanvas({ width, height } = PoseEstimatorService.DIMENSIONS) {
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
        this.poseEstimatorService.loadImageToCanvas(this.videoPlayer.current, true)
        if (isVideoPlaying) {
          this.interval = setTimeout(async () => {
            await this.poseEstimatorService.loadImageAndRunPosenet(this.videoPlayer.current, true);
            drawToCanvasLoop.call(this)
          }, this.state.videoCaptureTimeout);
        }else{
          await this.poseEstimatorService.loadImageAndRunPosenet(this.videoPlayer.current, true);
          
        }
      };

      this.videoPlayer.current.addEventListener('play', drawToCanvasLoop.bind(this));
      this.videoPlayer.current.addEventListener('stop', () => clearTimeout(this.interval));
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
          {/* <Button variant="contained"
          color="secondary"
          onClick={this.buildDataset.bind(this)}
          >Build dataset</Button> */}
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
          Min Score: {this.state.minScoreToDraw}
          <Slider
          onChange={(e, val) => this.setProp('minScoreToDraw', val)}
          value={this.state.minScoreToDraw}
          max={1}
          min={0}
          step={0.05}
          />
          </div>
          <div>
          Video capture interval: {this.state.videoCaptureTimeout}
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
    }
