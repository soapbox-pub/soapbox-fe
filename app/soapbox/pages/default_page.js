import React from 'react';
import { connect } from 'react-redux';
import ImmutablePureComponent from 'react-immutable-pure-component';
import BundleContainer from 'soapbox/features/ui/containers/bundle_container';
import {
  WhoToFollowPanel,
  TrendsPanel,
  PromoPanel,
  FeaturesPanel,
  SignUpPanel,
} from 'soapbox/features/ui/util/async-components';
import LinkFooter from 'soapbox/features/ui/components/link_footer';
import { getFeatures } from 'soapbox/utils/features';

const mapStateToProps = state => {
  const me = state.get('me');
  const features = getFeatures(state.get('instance'));

  return {
    me,
    showTrendsPanel: features.trends,
    showWhoToFollowPanel: features.suggestions,
  };
};

export default @connect(mapStateToProps)
class DefaultPage extends ImmutablePureComponent {

  render() {
    const { me, children, showTrendsPanel, showWhoToFollowPanel } = this.props;

    return (
      <div className='page'>
        <div className='page__columns'>
          <div className='columns-area__panels'>

            <div className='columns-area__panels__pane columns-area__panels__pane--left'>
              <div className='columns-area__panels__pane__inner' />
            </div>

            <div className='columns-area__panels__main'>
              <div className='columns-area columns-area--mobile'>
                {children}
              </div>
            </div>

            <div className='columns-area__panels__pane columns-area__panels__pane--right'>
              <div className='columns-area__panels__pane__inner'>
                {me ? (
                  <BundleContainer fetchComponent={FeaturesPanel}>
                    {Component => <Component key='features-panel' />}
                  </BundleContainer>
                ) : (
                  <BundleContainer fetchComponent={SignUpPanel}>
                    {Component => <Component key='sign-up-panel' />}
                  </BundleContainer>
                )}
                {showTrendsPanel && (
                  <BundleContainer fetchComponent={TrendsPanel}>
                    {Component => <Component key='trends-panel' />}
                  </BundleContainer>
                )}
                {showWhoToFollowPanel && (
                  <BundleContainer fetchComponent={WhoToFollowPanel}>
                    {Component => <Component limit={5} key='wtf-panel' />}
                  </BundleContainer>
                )}
                <BundleContainer fetchComponent={PromoPanel}>
                  {Component => <Component key='promo-panel' />}
                </BundleContainer>
                <LinkFooter key='link-footer' />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

}
