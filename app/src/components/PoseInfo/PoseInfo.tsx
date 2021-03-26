import React from 'react';
import PropTypes from 'prop-types';
import './PoseInfo.css';

const PoseInfo = (props) => (
  <div className="PoseInfo" data-testid="PoseInfo">
    <span>{props.title}:</span>
    <span className="value-data">{props.value.map(val => <div>{val}</div> )}</span>
  </div>
);

PoseInfo.propTypes = {
  title: PropTypes.string,
};

PoseInfo.defaultProps = {
  value: []
};

export default PoseInfo;
