import React from 'react';
import PropTypes from 'prop-types';
import './PoseInfo.css';

const PoseInfo = (props) => (
  <div className="PoseInfo" data-testid="PoseInfo">
    <span>{props.title}:</span>
    <div className="value-data">{props.value.map((val, key) => <span key={key}>{val}</span> )}</div>
  </div>
);

PoseInfo.propTypes = {
  title: PropTypes.string,
  value: PropTypes.arrayOf(PropTypes.string),
};

PoseInfo.defaultProps = {
  value: []
};

export default PoseInfo;
