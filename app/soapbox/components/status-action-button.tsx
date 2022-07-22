import classNames from 'classnames';
import React from 'react';

import { Text, Icon, Emoji } from 'soapbox/components/ui';
import { shortNumberFormat } from 'soapbox/utils/numbers';

const COLORS = {
  accent: 'accent',
  success: 'success',
};

type Color = keyof typeof COLORS;

interface IStatusActionCounter {
  count: number,
}

/** Action button numerical counter, eg "5" likes. */
const StatusActionCounter: React.FC<IStatusActionCounter> = ({ count = 0 }): JSX.Element => {
  return (
    <Text size='xs' weight='semibold' theme='inherit'>
      {shortNumberFormat(count)}
    </Text>
  );
};

interface IStatusActionButton extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  iconClassName?: string,
  icon: string,
  count?: number,
  active?: boolean,
  color?: Color,
  filled?: boolean,
  emoji?: string,
}

const StatusActionButton = React.forwardRef<HTMLButtonElement, IStatusActionButton>((props, ref): JSX.Element => {
  const { icon, className, iconClassName, active, color, filled = false, count = 0, emoji, ...filteredProps } = props;

  return (
    <button
      ref={ref}
      type='button'
      className={classNames(
        'flex items-center p-1 space-x-0.5 rounded-full',
        'text-gray-600 hover:text-gray-600 dark:hover:text-white',
        'bg-white dark:bg-transparent',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:ring-offset-0',
        {
          'text-black dark:text-white': active && emoji,
          'text-accent-300 hover:text-accent-300 dark:hover:text-accent-300': active && !emoji && color === COLORS.accent,
          'text-success-600 hover:text-success-600 dark:hover:text-success-600': active && !emoji && color === COLORS.success,
        },
        className,
      )}
      {...filteredProps}
    >
      {emoji ? (
        <span className='block w-6 h-6 flex items-center justify-center'>
          <Emoji className='w-full h-full p-0.5' emoji={emoji} />
        </span>
      ) : (
        <Icon
          src={icon}
          className={classNames(
            {
              'fill-accent-300 hover:fill-accent-300': active && filled && color === COLORS.accent,
            },
            iconClassName,
          )}
        />
      )}

      {(count || null) && (
        <StatusActionCounter count={count} />
      )}
    </button>
  );
});

export default StatusActionButton;
