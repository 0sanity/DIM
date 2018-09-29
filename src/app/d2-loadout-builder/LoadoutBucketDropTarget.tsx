import * as React from 'react';
import {
  DropTarget,
  DropTargetSpec,
  DropTargetConnector,
  DropTargetMonitor,
  ConnectDropTarget
} from 'react-dnd';
import * as classNames from 'classnames';
import { DimItem } from '../inventory/item-types';

interface ExternalProps {
  bucketType: string;
  children?: React.ReactNode;
  onItemLocked(lockedItem: DimItem): void;
}

// These are all provided by the DropTarget HOC function
interface InternalProps {
  connectDropTarget: ConnectDropTarget;
  isOver: boolean;
}

type Props = InternalProps & ExternalProps;

// This determines what types can be dropped on this target
function dragType(props: ExternalProps) {
  return props.bucketType!;
}

// This determines the behavior of dropping on this target
const dropSpec: DropTargetSpec<Props> = {
  drop(props, monitor) {
    // TODO: ooh, monitor has interesting offset info
    // https://github.com/react-dnd/react-dnd-html5-backend/issues/23
    const item = monitor.getItem().item as DimItem;
    props.onItemLocked(item);
  }
};

// This forwards drag and drop state into props on the component
function collect(connect: DropTargetConnector, monitor: DropTargetMonitor): InternalProps {
  return {
    // Call this function inside render()
    // to let React DnD handle the drag events:
    connectDropTarget: connect.dropTarget(),
    // You can ask the monitor about the current drag state:
    isOver: monitor.isOver()
  };
}

class LoadoutBucketDropTarget extends React.Component<Props> {
  render() {
    const { connectDropTarget, children, isOver } = this.props;

    // TODO: I don't like that we're managing the classes for sub-bucket here
    return connectDropTarget(
      <div
        className={classNames({
          'on-loadout-hover': isOver
        })}
      >
        {children}
      </div>
    );
  }
}

export default DropTarget(dragType, dropSpec, collect)(LoadoutBucketDropTarget);
