import React from 'react';
import './App.css';
import PoseEstimator from './components/PoseEstimator/PoseEstimator'
import PoseTester from './screens/PoseTester'

function App() {
  return (
    <div className="App">
      <PoseTester />
      <PoseEstimator/>
    </div>
  );
}

export default App;
