import React from 'react';
import { FormattedMessage, defineMessages, useIntl } from 'react-intl';
import { useDispatch } from 'react-redux';
import { Link, useHistory } from 'react-router-dom';

import { changeSettingImmediate } from 'soapbox/actions/settings';
import snackbar from 'soapbox/actions/snackbar';
import { Text } from 'soapbox/components/ui';
import SvgIcon from 'soapbox/components/ui/icon/svg-icon';

import Column from '../ui/components/column';

const messages = defineMessages({
  heading: { id: 'column.developers', defaultMessage: 'Developers' },
  leave: { id: 'developers.leave', defaultMessage: 'You have left developers' },
});

const Developers = () => {
  const dispatch = useDispatch();
  const history = useHistory();
  const intl = useIntl();

  const leaveDevelopers = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    dispatch(changeSettingImmediate(['isDeveloper'], false));
    dispatch(snackbar.success(intl.formatMessage(messages.leave)));
    history.push('/');
  };

  return (
    <Column label={intl.formatMessage(messages.heading)}>
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2'>
        <Link to='/developers/apps/create' className='bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-800/75 p-4 rounded flex flex-col items-center justify-center space-y-2'>
          <SvgIcon src={require('@tabler/icons/apps.svg')} className='text-gray-700 dark:text-gray-600' />

          <Text>
            <FormattedMessage id='developers.navigation.app_create_label' defaultMessage='Create an app' />
          </Text>
        </Link>

        <Link to='/developers/settings_store' className='bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-800/75 p-4 rounded flex flex-col items-center justify-center space-y-2'>
          <SvgIcon src={require('@tabler/icons/code-plus.svg')} className='text-gray-700 dark:text-gray-600' />

          <Text>
            <FormattedMessage id='developers.navigation.settings_store_label' defaultMessage='Settings store' />
          </Text>
        </Link>

        <Link to='/developers/timeline' className='bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-800/75 p-4 rounded flex flex-col items-center justify-center space-y-2'>
          <SvgIcon src={require('@tabler/icons/home.svg')} className='text-gray-700 dark:text-gray-600' />

          <Text>
            <FormattedMessage id='developers.navigation.test_timeline_label' defaultMessage='Test timeline' />
          </Text>
        </Link>

        <Link to='/error' className='bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-800/75 p-4 rounded flex flex-col items-center justify-center space-y-2'>
          <SvgIcon src={require('@tabler/icons/mood-sad.svg')} className='text-gray-700 dark:text-gray-600' />

          <Text>
            <FormattedMessage id='developers.navigation.intentional_error_label' defaultMessage='Trigger an error' />
          </Text>
        </Link>

        <Link to='/error/network' className='bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-800/75 p-4 rounded flex flex-col items-center justify-center space-y-2'>
          <SvgIcon src={require('@tabler/icons/refresh.svg')} className='text-gray-700 dark:text-gray-600' />

          <Text>
            <FormattedMessage id='developers.navigation.network_error_label' defaultMessage='Network error' />
          </Text>
        </Link>

        <button onClick={leaveDevelopers} className='bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-800/75 p-4 rounded flex flex-col items-center justify-center space-y-2'>
          <SvgIcon src={require('@tabler/icons/logout.svg')} className='text-gray-700 dark:text-gray-600' />

          <Text>
            <FormattedMessage id='developers.navigation.leave_developers_label' defaultMessage='Leave developers' />
          </Text>
        </button>
      </div>
    </Column>
  );
};

export default Developers;
