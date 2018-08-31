import * as React from 'react';
import { DimItem } from './item-types';
import './item-icon.scss';

interface Props {
  item: DimItem;
}

// tslint:disable-next-line:no-empty-interface
interface State {
}

export default class ItemIcon extends React.Component<Props, State> {

  constructor(props: Props) {
    super(props);

    this.state = {};
  }

  render() {
    const { item } = this.props;

    if (!item) {
      return (
        <div className="forsaken-item">NIF</div>
      );
    }

    const styles = {
      backgroundImage: `url('https://www.bungie.net${ item.icon }')`
    };

    return (
      <div className="forsaken-item">
        <div className='Image'>
          <div className="image-well" style={styles} />
        </div>
        <div className='Plugs'>
          <div className='area-overlap 1p'/>
          <div className='2p'/>
          <div className='3p'/>
        </div>
        <div className='Attributes'>
          <div className='area-overlap 1a' />
          <div className='2a'><div>{item.primStat && item.primStat.value}</div></div>
        </div>
      </div>
    );
  }
}
