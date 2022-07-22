import classNames from 'classnames';
import { List as ImmutableList, OrderedSet as ImmutableOrderedSet } from 'immutable';
import React from 'react';
import { HotKeys } from 'react-hotkeys';
import ImmutablePureComponent from 'react-immutable-pure-component';
import { defineMessages, injectIntl, FormattedMessage, WrappedComponentProps as IntlComponentProps } from 'react-intl';
import { connect } from 'react-redux';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { createSelector } from 'reselect';

import { blockAccount } from 'soapbox/actions/accounts';
import { launchChat } from 'soapbox/actions/chats';
import {
  replyCompose,
  mentionCompose,
  directCompose,
  quoteCompose,
} from 'soapbox/actions/compose';
import { simpleEmojiReact } from 'soapbox/actions/emoji_reacts';
import {
  favourite,
  unfavourite,
  reblog,
  unreblog,
  bookmark,
  unbookmark,
  pin,
  unpin,
} from 'soapbox/actions/interactions';
import { openModal } from 'soapbox/actions/modals';
import {
  deactivateUserModal,
  deleteUserModal,
  deleteStatusModal,
  toggleStatusSensitivityModal,
} from 'soapbox/actions/moderation';
import { initMuteModal } from 'soapbox/actions/mutes';
import { initReport } from 'soapbox/actions/reports';
import { getSettings } from 'soapbox/actions/settings';
import { getSoapboxConfig } from 'soapbox/actions/soapbox';
import {
  muteStatus,
  unmuteStatus,
  deleteStatus,
  hideStatus,
  revealStatus,
  editStatus,
  fetchStatusWithContext,
  fetchNext,
} from 'soapbox/actions/statuses';
import MissingIndicator from 'soapbox/components/missing_indicator';
import PullToRefresh from 'soapbox/components/pull-to-refresh';
import ScrollableList from 'soapbox/components/scrollable_list';
import { textForScreenReader } from 'soapbox/components/status';
import SubNavigation from 'soapbox/components/sub_navigation';
import Tombstone from 'soapbox/components/tombstone';
import { Column, Stack } from 'soapbox/components/ui';
import PlaceholderStatus from 'soapbox/features/placeholder/components/placeholder_status';
import PendingStatus from 'soapbox/features/ui/components/pending_status';
import { makeGetStatus } from 'soapbox/selectors';
import { defaultMediaVisibility } from 'soapbox/utils/status';

import { attachFullscreenListener, detachFullscreenListener, isFullscreen } from '../ui/util/fullscreen';

import ActionBar from './components/action-bar';
import DetailedStatus from './components/detailed-status';
import ThreadLoginCta from './components/thread-login-cta';
import ThreadStatus from './components/thread-status';

import type { AxiosError } from 'axios';
import type { History } from 'history';
import type { VirtuosoHandle } from 'react-virtuoso';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import type { RootState } from 'soapbox/store';
import type {
  Account as AccountEntity,
  Attachment as AttachmentEntity,
  Status as StatusEntity,
} from 'soapbox/types/entities';
import type { Me } from 'soapbox/types/soapbox';

const messages = defineMessages({
  title: { id: 'status.title', defaultMessage: '@{username}\'s Post' },
  titleDirect: { id: 'status.title_direct', defaultMessage: 'Direct message' },
  deleteConfirm: { id: 'confirmations.delete.confirm', defaultMessage: 'Delete' },
  deleteHeading: { id: 'confirmations.delete.heading', defaultMessage: 'Delete post' },
  deleteMessage: { id: 'confirmations.delete.message', defaultMessage: 'Are you sure you want to delete this post?' },
  redraftConfirm: { id: 'confirmations.redraft.confirm', defaultMessage: 'Delete & redraft' },
  redraftHeading: { id: 'confirmations.redraft.heading', defaultMessage: 'Delete & redraft' },
  redraftMessage: { id: 'confirmations.redraft.message', defaultMessage: 'Are you sure you want to delete this post and re-draft it? Favorites and reposts will be lost, and replies to the original post will be orphaned.' },
  blockConfirm: { id: 'confirmations.block.confirm', defaultMessage: 'Block' },
  revealAll: { id: 'status.show_more_all', defaultMessage: 'Show more for all' },
  hideAll: { id: 'status.show_less_all', defaultMessage: 'Show less for all' },
  detailedStatus: { id: 'status.detailed_status', defaultMessage: 'Detailed conversation view' },
  replyConfirm: { id: 'confirmations.reply.confirm', defaultMessage: 'Reply' },
  replyMessage: { id: 'confirmations.reply.message', defaultMessage: 'Replying now will overwrite the message you are currently composing. Are you sure you want to proceed?' },
  blockAndReport: { id: 'confirmations.block.block_and_report', defaultMessage: 'Block & Report' },
});

const makeMapStateToProps = () => {
  const getStatus = makeGetStatus();

  const getAncestorsIds = createSelector([
    (_: RootState, statusId: string | undefined) => statusId,
    (state: RootState) => state.contexts.inReplyTos,
  ], (statusId, inReplyTos) => {
    let ancestorsIds = ImmutableOrderedSet<string>();
    let id: string | undefined = statusId;

    while (id && !ancestorsIds.includes(id)) {
      ancestorsIds = ImmutableOrderedSet([id]).union(ancestorsIds);
      id = inReplyTos.get(id);
    }

    return ancestorsIds;
  });

  const getDescendantsIds = createSelector([
    (_: RootState, statusId: string) => statusId,
    (state: RootState) => state.contexts.replies,
  ], (statusId, contextReplies) => {
    let descendantsIds = ImmutableOrderedSet();
    const ids = [statusId];

    while (ids.length > 0) {
      const id = ids.shift();
      if (!id) break;

      const replies = contextReplies.get(id);

      if (descendantsIds.includes(id)) {
        break;
      }

      if (statusId !== id) {
        descendantsIds = descendantsIds.union([id]);
      }

      if (replies) {
        replies.reverse().forEach((reply: string) => {
          ids.unshift(reply);
        });
      }
    }

    return descendantsIds;
  });

  const mapStateToProps = (state: RootState, props: { params: RouteParams }) => {
    const status = getStatus(state, { id: props.params.statusId });
    let ancestorsIds = ImmutableOrderedSet();
    let descendantsIds = ImmutableOrderedSet();

    if (status) {
      const statusId = status.id;
      ancestorsIds = getAncestorsIds(state, state.contexts.inReplyTos.get(statusId));
      descendantsIds = getDescendantsIds(state, statusId);
      ancestorsIds = ancestorsIds.delete(statusId).subtract(descendantsIds);
      descendantsIds = descendantsIds.delete(statusId).subtract(ancestorsIds);
    }

    const soapbox = getSoapboxConfig(state);

    return {
      status,
      ancestorsIds,
      descendantsIds,
      askReplyConfirmation: state.compose.text.trim().length !== 0,
      me: state.me,
      displayMedia: getSettings(state).get('displayMedia'),
      allowedEmoji: soapbox.allowedEmoji,
    };
  };

  return mapStateToProps;
};

type DisplayMedia = 'default' | 'hide_all' | 'show_all';
type RouteParams = { statusId: string };

interface IStatus extends RouteComponentProps, IntlComponentProps {
  params: RouteParams,
  dispatch: ThunkDispatch<RootState, void, AnyAction>,
  status: StatusEntity,
  ancestorsIds: ImmutableOrderedSet<string>,
  descendantsIds: ImmutableOrderedSet<string>,
  askReplyConfirmation: boolean,
  displayMedia: DisplayMedia,
  allowedEmoji: ImmutableList<string>,
  onOpenMedia: (media: ImmutableList<AttachmentEntity>, index: number) => void,
  onOpenVideo: (video: AttachmentEntity, time: number) => void,
  me: Me,
}

interface IStatusState {
  fullscreen: boolean,
  showMedia: boolean,
  loadedStatusId?: string,
  emojiSelectorFocused: boolean,
  isLoaded: boolean,
  error?: AxiosError,
  next?: string,
}

class Status extends ImmutablePureComponent<IStatus, IStatusState> {

  state = {
    fullscreen: false,
    showMedia: defaultMediaVisibility(this.props.status, this.props.displayMedia),
    loadedStatusId: undefined,
    emojiSelectorFocused: false,
    isLoaded: Boolean(this.props.status),
    error: undefined,
    next: undefined,
  };

  node: HTMLDivElement | null = null;
  status: HTMLDivElement | null = null;
  scroller: VirtuosoHandle | null = null;
  _scrolledIntoView: boolean = false;

  fetchData = async() => {
    const { dispatch, params } = this.props;
    const { statusId } = params;
    const { next } = await dispatch(fetchStatusWithContext(statusId));
    this.setState({ next });
  }

  componentDidMount() {
    this.fetchData().then(() => {
      this.setState({ isLoaded: true });
    }).catch(error => {
      this.setState({ error, isLoaded: true });
    });
    attachFullscreenListener(this.onFullScreenChange);
  }

  handleToggleMediaVisibility = () => {
    this.setState({ showMedia: !this.state.showMedia });
  }

  handleEmojiReactClick = (status: StatusEntity, emoji: string) => {
    this.props.dispatch(simpleEmojiReact(status, emoji));
  }

  handleFavouriteClick = (status: StatusEntity) => {
    if (status.favourited) {
      this.props.dispatch(unfavourite(status));
    } else {
      this.props.dispatch(favourite(status));
    }
  }

  handlePin = (status: StatusEntity) => {
    if (status.pinned) {
      this.props.dispatch(unpin(status));
    } else {
      this.props.dispatch(pin(status));
    }
  }

  handleBookmark = (status: StatusEntity) => {
    if (status.bookmarked) {
      this.props.dispatch(unbookmark(status));
    } else {
      this.props.dispatch(bookmark(status));
    }
  }

  handleReplyClick = (status: StatusEntity) => {
    const { askReplyConfirmation, dispatch, intl } = this.props;
    if (askReplyConfirmation) {
      dispatch(openModal('CONFIRM', {
        message: intl.formatMessage(messages.replyMessage),
        confirm: intl.formatMessage(messages.replyConfirm),
        onConfirm: () => dispatch(replyCompose(status)),
      }));
    } else {
      dispatch(replyCompose(status));
    }
  }

  handleModalReblog = (status: StatusEntity) => {
    this.props.dispatch(reblog(status));
  }

  handleReblogClick = (status: StatusEntity, e?: React.MouseEvent) => {
    this.props.dispatch((_, getState) => {
      const boostModal = getSettings(getState()).get('boostModal');
      if (status.reblogged) {
        this.props.dispatch(unreblog(status));
      } else {
        if ((e && e.shiftKey) || !boostModal) {
          this.handleModalReblog(status);
        } else {
          this.props.dispatch(openModal('BOOST', { status, onReblog: this.handleModalReblog }));
        }
      }
    });
  }

  handleQuoteClick = (status: StatusEntity) => {
    const { askReplyConfirmation, dispatch, intl } = this.props;
    if (askReplyConfirmation) {
      dispatch(openModal('CONFIRM', {
        message: intl.formatMessage(messages.replyMessage),
        confirm: intl.formatMessage(messages.replyConfirm),
        onConfirm: () => dispatch(quoteCompose(status)),
      }));
    } else {
      dispatch(quoteCompose(status));
    }
  }

  handleDeleteClick = (status: StatusEntity, withRedraft = false) => {
    const { dispatch, intl } = this.props;

    this.props.dispatch((_, getState) => {
      const deleteModal = getSettings(getState()).get('deleteModal');
      if (!deleteModal) {
        dispatch(deleteStatus(status.id, withRedraft));
      } else {
        dispatch(openModal('CONFIRM', {
          icon: withRedraft ? require('@tabler/icons/edit.svg') : require('@tabler/icons/trash.svg'),
          heading: intl.formatMessage(withRedraft ? messages.redraftHeading : messages.deleteHeading),
          message: intl.formatMessage(withRedraft ? messages.redraftMessage : messages.deleteMessage),
          confirm: intl.formatMessage(withRedraft ? messages.redraftConfirm : messages.deleteConfirm),
          onConfirm: () => dispatch(deleteStatus(status.id, withRedraft)),
        }));
      }
    });
  }

  handleEditClick = (status: StatusEntity) => {
    const { dispatch } = this.props;

    dispatch(editStatus(status.id));
  }

  handleDirectClick = (account: AccountEntity) => {
    this.props.dispatch(directCompose(account));
  }

  handleChatClick = (account: AccountEntity, router: History) => {
    this.props.dispatch(launchChat(account.id, router));
  }

  handleMentionClick = (account: AccountEntity) => {
    this.props.dispatch(mentionCompose(account));
  }

  handleOpenMedia = (media: ImmutableList<AttachmentEntity>, index: number) => {
    this.props.dispatch(openModal('MEDIA', { media, index }));
  }

  handleOpenVideo = (media: ImmutableList<AttachmentEntity>, time: number) => {
    this.props.dispatch(openModal('VIDEO', { media, time }));
  }

  handleHotkeyOpenMedia = (e?: KeyboardEvent) => {
    const { status, onOpenMedia, onOpenVideo } = this.props;
    const firstAttachment = status.media_attachments.get(0);

    e?.preventDefault();

    if (status.media_attachments.size > 0 && firstAttachment) {
      if (firstAttachment.type === 'video') {
        onOpenVideo(firstAttachment, 0);
      } else {
        onOpenMedia(status.media_attachments, 0);
      }
    }
  }

  handleMuteClick = (account: AccountEntity) => {
    this.props.dispatch(initMuteModal(account));
  }

  handleConversationMuteClick = (status: StatusEntity) => {
    if (status.muted) {
      this.props.dispatch(unmuteStatus(status.id));
    } else {
      this.props.dispatch(muteStatus(status.id));
    }
  }

  handleToggleHidden = (status: StatusEntity) => {
    if (status.hidden) {
      this.props.dispatch(revealStatus(status.id));
    } else {
      this.props.dispatch(hideStatus(status.id));
    }
  }

  handleToggleAll = () => {
    const { status, ancestorsIds, descendantsIds } = this.props;
    const statusIds = [status.id].concat(ancestorsIds.toArray(), descendantsIds.toArray());

    if (status.hidden) {
      this.props.dispatch(revealStatus(statusIds));
    } else {
      this.props.dispatch(hideStatus(statusIds));
    }
  }

  handleBlockClick = (status: StatusEntity) => {
    const { dispatch, intl } = this.props;
    const { account } = status;
    if (!account || typeof account !== 'object') return;

    dispatch(openModal('CONFIRM', {
      icon: require('@tabler/icons/ban.svg'),
      heading: <FormattedMessage id='confirmations.block.heading' defaultMessage='Block @{name}' values={{ name: account.acct }} />,
      message: <FormattedMessage id='confirmations.block.message' defaultMessage='Are you sure you want to block {name}?' values={{ name: <strong>@{account.acct}</strong> }} />,
      confirm: intl.formatMessage(messages.blockConfirm),
      onConfirm: () => dispatch(blockAccount(account.id)),
      secondary: intl.formatMessage(messages.blockAndReport),
      onSecondary: () => {
        dispatch(blockAccount(account.id));
        dispatch(initReport(account, status));
      },
    }));
  }

  handleReport = (status: StatusEntity) => {
    this.props.dispatch(initReport(status.account as AccountEntity, status));
  }

  handleEmbed = (status: StatusEntity) => {
    this.props.dispatch(openModal('EMBED', { url: status.url }));
  }

  handleDeactivateUser = (status: StatusEntity) => {
    const { dispatch, intl } = this.props;
    dispatch(deactivateUserModal(intl, status.getIn(['account', 'id']) as string));
  }

  handleDeleteUser = (status: StatusEntity) => {
    const { dispatch, intl } = this.props;
    dispatch(deleteUserModal(intl, status.getIn(['account', 'id']) as string));
  }

  handleToggleStatusSensitivity = (status: StatusEntity) => {
    const { dispatch, intl } = this.props;
    dispatch(toggleStatusSensitivityModal(intl, status.id, status.sensitive));
  }

  handleDeleteStatus = (status: StatusEntity) => {
    const { dispatch, intl } = this.props;
    dispatch(deleteStatusModal(intl, status.id));
  }

  handleHotkeyMoveUp = () => {
    this.handleMoveUp(this.props.status.id);
  }

  handleHotkeyMoveDown = () => {
    this.handleMoveDown(this.props.status.id);
  }

  handleHotkeyReply = (e?: KeyboardEvent) => {
    e?.preventDefault();
    this.handleReplyClick(this.props.status);
  }

  handleHotkeyFavourite = () => {
    this.handleFavouriteClick(this.props.status);
  }

  handleHotkeyBoost = () => {
    this.handleReblogClick(this.props.status);
  }

  handleHotkeyMention = (e?: KeyboardEvent) => {
    e?.preventDefault();
    const { account } = this.props.status;
    if (!account || typeof account !== 'object') return;
    this.handleMentionClick(account);
  }

  handleHotkeyOpenProfile = () => {
    this.props.history.push(`/@${this.props.status.getIn(['account', 'acct'])}`);
  }

  handleHotkeyToggleHidden = () => {
    this.handleToggleHidden(this.props.status);
  }

  handleHotkeyToggleSensitive = () => {
    this.handleToggleMediaVisibility();
  }

  handleHotkeyReact = () => {
    this._expandEmojiSelector();
  }

  handleMoveUp = (id: string) => {
    const { status, ancestorsIds, descendantsIds } = this.props;

    if (id === status.id) {
      this._selectChild(ancestorsIds.size - 1);
    } else {
      let index = ImmutableList(ancestorsIds).indexOf(id);

      if (index === -1) {
        index = ImmutableList(descendantsIds).indexOf(id);
        this._selectChild(ancestorsIds.size + index);
      } else {
        this._selectChild(index - 1);
      }
    }
  }

  handleMoveDown = (id: string) => {
    const { status, ancestorsIds, descendantsIds } = this.props;

    if (id === status.id) {
      this._selectChild(ancestorsIds.size + 1);
    } else {
      let index = ImmutableList(ancestorsIds).indexOf(id);

      if (index === -1) {
        index = ImmutableList(descendantsIds).indexOf(id);
        this._selectChild(ancestorsIds.size + index + 2);
      } else {
        this._selectChild(index + 1);
      }
    }
  }

  handleEmojiSelectorExpand: React.EventHandler<React.KeyboardEvent> = e => {
    if (e.key === 'Enter') {
      this._expandEmojiSelector();
    }
    e.preventDefault();
  }

  handleEmojiSelectorUnfocus: React.EventHandler<React.KeyboardEvent> = () => {
    this.setState({ emojiSelectorFocused: false });
  }

  _expandEmojiSelector = () => {
    if (!this.status) return;
    this.setState({ emojiSelectorFocused: true });
    const firstEmoji: HTMLButtonElement | null = this.status.querySelector('.emoji-react-selector .emoji-react-selector__emoji');
    firstEmoji?.focus();
  };

  _selectChild(index: number) {
    this.scroller?.scrollIntoView({
      index,
      behavior: 'smooth',
      done: () => {
        const element = document.querySelector<HTMLDivElement>(`#thread [data-index="${index}"] .focusable`);

        if (element) {
          element.focus();
        }
      },
    });
  }

  renderTombstone(id: string) {
    return (
      <div className='py-4 pb-8'>
        <Tombstone
          key={id}
          id={id}
          onMoveUp={this.handleMoveUp}
          onMoveDown={this.handleMoveDown}
        />
      </div>
    );
  }

  renderStatus(id: string) {
    const { status } = this.props;

    return (
      <ThreadStatus
        key={id}
        id={id}
        focusedStatusId={status.id}
        // @ts-ignore FIXME
        onMoveUp={this.handleMoveUp}
        onMoveDown={this.handleMoveDown}
      />
    );
  }

  renderPendingStatus(id: string) {
    // const { status } = this.props;
    const idempotencyKey = id.replace(/^末pending-/, '');

    return (
      <PendingStatus
        className='thread__status'
        key={id}
        idempotencyKey={idempotencyKey}
        // focusedStatusId={status.id}
        // onMoveUp={this.handleMoveUp}
        // onMoveDown={this.handleMoveDown}
        // contextType='thread'
      />
    );
  }

  renderChildren(list: ImmutableOrderedSet<string>) {
    return list.map(id => {
      if (id.endsWith('-tombstone')) {
        return this.renderTombstone(id);
      } else if (id.startsWith('末pending-')) {
        return this.renderPendingStatus(id);
      } else {
        return this.renderStatus(id);
      }
    });
  }

  setRef: React.RefCallback<HTMLDivElement> = c => {
    this.node = c;
  }

  setStatusRef: React.RefCallback<HTMLDivElement> = c => {
    this.status = c;
  }

  componentDidUpdate(prevProps: IStatus, prevState: IStatusState) {
    const { params, status, displayMedia, ancestorsIds } = this.props;
    const { isLoaded } = this.state;

    if (params.statusId !== prevProps.params.statusId) {
      this.fetchData();
    }

    if (status && status.id !== prevState.loadedStatusId) {
      this.setState({ showMedia: defaultMediaVisibility(status, displayMedia), loadedStatusId: status.id });
    }

    if (params.statusId !== prevProps.params.statusId || status?.id !== prevProps.status?.id || ancestorsIds.size > prevProps.ancestorsIds.size || isLoaded !== prevState.isLoaded) {
      this.scroller?.scrollToIndex({
        index: this.props.ancestorsIds.size,
        offset: -80,
      });

      setImmediate(() => this.status?.querySelector<HTMLDivElement>('.detailed-status')?.focus());
    }
  }

  componentWillUnmount() {
    detachFullscreenListener(this.onFullScreenChange);
  }

  onFullScreenChange = () => {
    this.setState({ fullscreen: isFullscreen() });
  }

  handleRefresh = () => {
    return this.fetchData();
  }

  handleLoadMore = () => {
    const { status } = this.props;
    const { next } = this.state;

    if (next) {
      this.props.dispatch(fetchNext(status.id, next)).then(({ next }) => {
        this.setState({ next });
      }).catch(() => {});
    }
  }

  handleOpenCompareHistoryModal = (status: StatusEntity) => {
    const { dispatch } = this.props;

    dispatch(openModal('COMPARE_HISTORY', {
      statusId: status.id,
    }));
  }

  setScrollerRef = (c: VirtuosoHandle) => {
    this.scroller = c;
  }

  render() {
    const { me, status, ancestorsIds, descendantsIds, intl } = this.props;

    const hasAncestors = ancestorsIds && ancestorsIds.size > 0;
    const hasDescendants = descendantsIds && descendantsIds.size > 0;

    if (!status && this.state.isLoaded) {
      // TODO: handle errors other than 404 with `this.state.error?.response?.status`
      return (
        <MissingIndicator />
      );
    } else if (!status) {
      return (
        <PlaceholderStatus />
      );
    }

    type HotkeyHandlers = { [key: string]: (keyEvent?: KeyboardEvent) => void };

    const handlers: HotkeyHandlers = {
      moveUp: this.handleHotkeyMoveUp,
      moveDown: this.handleHotkeyMoveDown,
      reply: this.handleHotkeyReply,
      favourite: this.handleHotkeyFavourite,
      boost: this.handleHotkeyBoost,
      mention: this.handleHotkeyMention,
      openProfile: this.handleHotkeyOpenProfile,
      toggleHidden: this.handleHotkeyToggleHidden,
      toggleSensitive: this.handleHotkeyToggleSensitive,
      openMedia: this.handleHotkeyOpenMedia,
      react: this.handleHotkeyReact,
    };

    const username = String(status.getIn(['account', 'acct']));
    const titleMessage = status.visibility === 'direct' ? messages.titleDirect : messages.title;

    const focusedStatus = (
      <div className={classNames('thread__detailed-status', { 'pb-4': hasDescendants })} key={status.id}>
        <HotKeys handlers={handlers}>
          <div
            ref={this.setStatusRef}
            className='detailed-status__wrapper focusable'
            tabIndex={0}
            // FIXME: no "reblogged by" text is added for the screen reader
            aria-label={textForScreenReader(intl, status)}
          >
            {/* @ts-ignore */}
            <DetailedStatus
              status={status}
              onOpenVideo={this.handleOpenVideo}
              onOpenMedia={this.handleOpenMedia}
              onToggleHidden={this.handleToggleHidden}
              showMedia={this.state.showMedia}
              onToggleMediaVisibility={this.handleToggleMediaVisibility}
              onOpenCompareHistoryModal={this.handleOpenCompareHistoryModal}
            />

            <hr className='mb-2 dark:border-gray-800' />

            <ActionBar
              status={status}
              onReply={this.handleReplyClick}
              onFavourite={this.handleFavouriteClick}
              onEmojiReact={this.handleEmojiReactClick}
              onReblog={this.handleReblogClick}
              onQuote={this.handleQuoteClick}
              onDelete={this.handleDeleteClick}
              onEdit={this.handleEditClick}
              onDirect={this.handleDirectClick}
              onChat={this.handleChatClick}
              onMention={this.handleMentionClick}
              onMute={this.handleMuteClick}
              onMuteConversation={this.handleConversationMuteClick}
              onBlock={this.handleBlockClick}
              onReport={this.handleReport}
              onPin={this.handlePin}
              onBookmark={this.handleBookmark}
              onEmbed={this.handleEmbed}
              onDeactivateUser={this.handleDeactivateUser}
              onDeleteUser={this.handleDeleteUser}
              onToggleStatusSensitivity={this.handleToggleStatusSensitivity}
              onDeleteStatus={this.handleDeleteStatus}
              allowedEmoji={this.props.allowedEmoji}
              emojiSelectorFocused={this.state.emojiSelectorFocused}
              handleEmojiSelectorExpand={this.handleEmojiSelectorExpand}
              handleEmojiSelectorUnfocus={this.handleEmojiSelectorUnfocus}
            />
          </div>
        </HotKeys>

        {hasDescendants && (
          <hr className='mt-2 dark:border-gray-800' />
        )}
      </div>
    );

    const children: JSX.Element[] = [];

    if (hasAncestors) {
      children.push(...this.renderChildren(ancestorsIds).toArray());
    }

    children.push(focusedStatus);

    if (hasDescendants) {
      children.push(...this.renderChildren(descendantsIds).toArray());
    }

    return (
      <Column label={intl.formatMessage(titleMessage, { username })} transparent withHeader={false}>
        <div className='px-4 pt-4 sm:p-0'>
          <SubNavigation message={intl.formatMessage(titleMessage, { username })} />
        </div>

        <PullToRefresh onRefresh={this.handleRefresh}>
          <Stack space={2}>
            <div ref={this.setRef} className='thread'>
              <ScrollableList
                id='thread'
                ref={this.setScrollerRef}
                hasMore={!!this.state.next}
                onLoadMore={this.handleLoadMore}
                placeholderComponent={() => <PlaceholderStatus thread />}
                initialTopMostItemIndex={ancestorsIds.size}
              >
                {children}
              </ScrollableList>
            </div>

            {!me && <ThreadLoginCta />}
          </Stack>
        </PullToRefresh>
      </Column>
    );
  }

}

const WrappedComponent = withRouter(injectIntl(Status));
// @ts-ignore
export default connect(makeMapStateToProps)(WrappedComponent);
