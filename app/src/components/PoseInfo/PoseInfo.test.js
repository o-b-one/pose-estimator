import React from 'react';
import { cleanup, render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import PoseInfo from './PoseInfo';

describe('<PoseInfo />', () => {
  afterEach(cleanup);

  test('it should mount', () => {
    const { getByTestId } = render(<PoseInfo />);
    const poseInfo = getByTestId('PoseInfo');

    expect(poseInfo).toBeInTheDocument();
  });
});