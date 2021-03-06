import * as _ from 'lodash';
import { DimItem, DimSockets } from './item-types';
import { t } from 'i18next';

// step node names we'll hide, we'll leave "* Chroma" for now though, since we don't otherwise indicate Chroma
const FILTER_NODE_NAMES = [
  'Upgrade Defense',
  'Ascend',
  'Infuse',
  'Increase Intellect',
  'Increase Discipline',
  'Increase Strength',
  'Twist Fate',
  'The Life Exotic',
  'Reforge Artifact',
  'Reforge Shell',
  'Deactivate Chroma',
  'Kinetic Damage',
  'Solar Damage',
  'Arc Damage',
  'Void Damage',
  'Default Shader',
  'Default Ornament',
  'Empty Mod Socket',
  'No Projection'
];

const events = ['', 'Dawning', 'Crimson Days', 'Solstice of Heroes', 'Festival of the Lost'];

function capitalizeFirstLetter(str: string) {
  if (!str || str.length === 0) {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function downloadCsv(filename, csv) {
  filename = `${filename}.csv`;
  const pom = document.createElement('a');
  pom.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`);
  pom.setAttribute('download', filename);
  document.body.appendChild(pom);
  pom.click();
  document.body.removeChild(pom);
}

function buildSocketString(sockets: DimSockets): string {
  const socketItems = sockets.sockets.map((s) =>
    s.plugOptions
      .filter((p) => !FILTER_NODE_NAMES.some((n) => n === p.plugItem.displayProperties.name))
      .map((p) =>
        s.plug && s.plug.plugItem.hash && p.plugItem.hash === s.plug.plugItem.hash
          ? `${p.plugItem.displayProperties.name}*`
          : p.plugItem.displayProperties.name
      )
  );

  return socketItems.flat().join(',');
}

function buildNodeString(nodes) {
  let data = '';
  nodes.forEach((node) => {
    if (FILTER_NODE_NAMES.includes(node.name)) {
      return;
    }
    data += node.name;
    if (node.activated) {
      data += '*';
    }
    data += ',';
  });

  return data;
}

function downloadGhost(items, nameMap) {
  const header = 'Name,Hash,Id,Tag,Tier,Owner,Locked,Equipped,Perks\n';

  let data = '';
  items.forEach((item) => {
    data += `"${item.name}",`;
    data += `"${item.hash}",`;
    data += `${item.id},`;
    data += `${item.dimInfo.tag || ''},`;
    data += `${item.tier},`;
    data += `${nameMap[item.owner]},`;
    data += `${item.locked},`;
    data += `${item.equipped},`;

    if (item.talentGrid) {
      data += buildNodeString(item.talentGrid.nodes);
    } else if (item.sockets) {
      data += buildSocketString(item.sockets);
    }

    data += '\n';
  });

  downloadCsv('destinyGhosts', header + data);
}

function downloadArmor(items, nameMap) {
  const header =
    items[0].destinyVersion === 1
      ? 'Name,Hash,Id,Tag,Tier,Type,Equippable,Light,Owner,% Leveled,Locked,' +
        'Equipped,Year,DTR Rating,# of Reviews,% Quality,% IntQ,% DiscQ,% StrQ,' +
        'Int,Disc,Str,Notes,Perks\n'
      : 'Name,Hash,Id,Tag,Tier,Type,Equippable,Power,Owner,Locked,Equipped,' +
        'Year,Season,Event,DTR Rating,# of Reviews,Mobility,Recovery,' +
        'Resilience,Notes,Perks\n';
  let data = '';
  items.forEach((item) => {
    data += `"${item.name}",`;
    data += `"${item.hash}",`;
    data += `${item.id},`;
    data += `${item.dimInfo.tag || ''},`;
    data += `${item.tier},`;
    data += `${item.typeName},`;
    let equippable = item.classTypeName;
    if (!equippable || equippable === 'unknown') {
      equippable =
        !equippable || equippable === 'unknown' ? 'Any' : capitalizeFirstLetter(equippable);
    }
    data += `${equippable},`;
    data += `${item.primStat.value},`;
    data += `${nameMap[item.owner]},`;
    data += item.destinyVersion === 1 ? `${(item.percentComplete * 100).toFixed(0)},` : ``;
    data += `${item.locked},`;
    data += `${item.equipped},`;
    data += item.destinyVersion === 1 ? `${item.year},` : item.season <= 3 ? `1,` : `2,`;
    data += item.destinyVersion === 1 ? '' : `${item.season},`;
    data +=
      item.destinyVersion === 1 ? '' : item.event ? `${events[item.event]},` : `${events[0]},`;
    if (item.dtrRating && item.dtrRating.overallScore) {
      data += `${item.dtrRating.overallScore},${item.dtrRating.ratingCount},`;
    } else {
      data += 'N/A,N/A,';
    }
    data += item.destinyVersion === 1 ? (item.quality ? `${item.quality.min},` : '0,') : '';
    const stats: { [name: string]: { value: number; pct: number } } = {};
    if (item.stats) {
      item.stats.forEach((stat) => {
        let pct = 0;
        if (stat.scaled && stat.scaled.min) {
          pct = Math.round((100 * stat.scaled.min) / stat.split);
        }
        stats[stat.name] = {
          value: stat.value,
          pct
        };
      });
    }
    data += item.destinyVersion === 1 ? (stats.Intellect ? `${stats.Intellect.pct},` : '0,') : '';
    data += item.destinyVersion === 1 ? (stats.Discipline ? `${stats.Discipline.pct},` : '0,') : '';
    data += item.destinyVersion === 1 ? (stats.Strength ? `${stats.Strength.pct},` : '0,') : '';
    data +=
      item.destinyVersion === 1
        ? stats.Intellect
          ? `${stats.Intellect.value},`
          : '0,'
        : stats.Mobility
        ? `${stats.Mobility.value},`
        : '0,';
    data +=
      item.destinyVersion === 1
        ? stats.Discipline
          ? `${stats.Discipline.value},`
          : '0,'
        : stats.Recovery
        ? `${stats.Recovery.value},`
        : '0,';
    data +=
      item.destinyVersion === 1
        ? stats.Strength
          ? `${stats.Strength.value},`
          : '0,'
        : stats.Resilience
        ? `${stats.Resilience.value},`
        : '0,';

    data += cleanNotes(item);

    // if DB is out of date this can be null, can't hurt to be careful
    if (item.talentGrid) {
      data += buildNodeString(item.talentGrid.nodes);
    } else if (item.sockets) {
      data += buildSocketString(item.sockets);
    }
    data += '\n';
  });
  downloadCsv('destinyArmor', header + data);
}

function downloadWeapons(guns, nameMap) {
  const header =
    guns[0].destinyVersion === 1
      ? 'Name,Hash,Id,Tag,Tier,Type,Light,Dmg,Owner,% Leveled,Locked,Equipped,' +
        'Year,DTR Rating,# of Reviews,AA,Impact,Range,Stability,ROF,Reload,Mag,' +
        'Equip,Notes,Nodes\n'
      : 'Name,Hash,Id,Tag,Tier,Type,Power,Dmg,Owner,Locked,Equipped,Year,Season,' +
        'Event,DTR Rating,# of Reviews,AA,Impact,Range,Stability,ROF,Reload,Mag,' +
        'Equip,Notes,Nodes\n';
  let data = '';
  guns.forEach((gun) => {
    data += `"${gun.name}",`;
    data += `"${gun.hash}",`;
    data += `${gun.id},`;
    data += `${gun.dimInfo.tag || ''},`;
    data += `${gun.tier},`;
    data += `${gun.typeName},`;
    data += `${gun.primStat.value},`;
    if (gun.dmg) {
      data += `${capitalizeFirstLetter(gun.dmg)},`;
    } else {
      data += 'Kinetic,';
    }
    data += `${nameMap[gun.owner]},`;
    data += gun.destinyVersion === 1 ? `${(gun.percentComplete * 100).toFixed(0)},` : ``;
    data += `${gun.locked},`;
    data += `${gun.equipped},`;
    data += gun.destinyVersion === 1 ? `${gun.year},` : gun.season <= 3 ? `1,` : `2,`;
    data += gun.destinyVersion === 1 ? '' : `${gun.season},`;
    data += gun.destinyVersion === 1 ? '' : gun.event ? `${events[gun.event]},` : `${events[0]},`;
    if (gun.dtrRating && gun.dtrRating.overallScore) {
      data += `${gun.dtrRating.overallScore},${gun.dtrRating.ratingCount},`;
    } else {
      data += 'N/A,N/A,';
    }
    const stats = {
      aa: 0,
      impact: 0,
      range: 0,
      stability: 0,
      rof: 0,
      reload: 0,
      magazine: 0,
      equipSpeed: 0
    };
    gun.stats.forEach((stat) => {
      switch (stat.statHash) {
        case 1345609583: // Aim Assist
          stats.aa = stat.value;
          break;
        case 4043523819: // Impact
          stats.impact = stat.value;
          break;
        case 1240592695: // Range
          stats.range = stat.value;
          break;
        case 155624089: // Stability
          stats.stability = stat.value;
          break;
        case 4284893193: // Rate of fire
          stats.rof = stat.value;
          break;
        case 4188031367: // Reload
          stats.reload = stat.value;
          break;
        case 3871231066: // Magazine
        case 925767036: // Energy
          stats.magazine = stat.value;
          break;
        case 943549884: // Equip Speed
          stats.equipSpeed = stat.value;
          break;
      }
    });
    data += `${stats.aa},`;
    data += `${stats.impact},`;
    data += `${stats.range},`;
    data += `${stats.stability},`;
    data += `${stats.rof},`;
    data += `${stats.reload},`;
    data += `${stats.magazine},`;
    data += `${stats.equipSpeed},`;

    data += cleanNotes(gun);

    // haven't seen this null yet, but can't hurt to check since we saw it on armor above
    if (gun.talentGrid) {
      data += buildNodeString(gun.talentGrid.nodes);
    } else if (gun.sockets) {
      data += buildSocketString(gun.sockets);
    }
    data += '\n';
  });
  downloadCsv('destinyWeapons', header + data);
}

function cleanNotes(item) {
  let cleanedNotes;
  // the Notes column may need CSV escaping, as it's user-supplied input.
  if (item.dimInfo && item.dimInfo.notes) {
    // if any of these four characters are present, we have to escape it.
    if (/[",\r\n]/.test(item.dimInfo.notes)) {
      const notes = item.dimInfo.notes;
      // emit the escaped data, wrapped in double quotes.
      // any instances of " need to be changed to "" per RFC 4180.
      // everything else is fine, as long as it's in double quotes.
      cleanedNotes = `"${notes.replace(/"/g, '""')}",`;
    } else {
      // no escaping required, append it as-is.
      cleanedNotes = `${item.dimInfo.notes},`;
    }
  } else {
    // terminate the empty Notes column with a comma and continue.
    cleanedNotes = ',';
  }
  return cleanedNotes;
}

export function downloadCsvFiles(stores, type) {
  // perhaps we're loading
  if (stores.length === 0) {
    alert(t('Settings.ExportSSNoStores'));
    return;
  }
  const nameMap = {};
  let allItems: DimItem[] = [];
  stores.forEach((store) => {
    allItems = allItems.concat(store.items);
    nameMap[store.id] =
      store.id === 'vault' ? 'Vault' : `${capitalizeFirstLetter(store.class)}(${store.powerLevel})`;
  });
  const items: DimItem[] = [];
  allItems.forEach((item) => {
    if (!item.primStat && type !== 'Ghost') {
      return;
    }

    if (type === 'Weapons') {
      if (
        item.primStat &&
        (item.primStat.statHash === 368428387 || item.primStat.statHash === 1480404414)
      ) {
        items.push(item);
      }
    } else if (type === 'Armor') {
      if (item.primStat && item.primStat.statHash === 3897883278) {
        items.push(item);
      }
    } else if (type === 'Ghost' && item.bucket.hash === 4023194814) {
      items.push(item);
    }
  });
  switch (type) {
    case 'Weapons':
      downloadWeapons(items, nameMap);
      break;
    case 'Armor':
      downloadArmor(items, nameMap);
      break;
    case 'Ghost':
      downloadGhost(items, nameMap);
      break;
  }
}
