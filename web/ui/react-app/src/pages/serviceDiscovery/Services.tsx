import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { LabelsTable } from './LabelsTable';
import { DroppedTarget, Labels, Target } from '../targets/target';

import { withStatusIndicator } from '../../components/withStatusIndicator';
import { setQuerySearchFilter, mapObjEntries, getQuerySearchFilter } from '../../utils';
import { usePathPrefix } from '../../contexts/PathPrefixContext';
import { API_PATH } from '../../constants/constants';
import { KVSearch } from '@nexucis/kvsearch';
import { Container } from 'reactstrap';
import SearchBar from '../../components/SearchBar';

interface ServiceMap {
  activeTargets: Target[];
  droppedTargets: DroppedTarget[];
  droppedTargetCounts: Record<string, number>;
}

export interface TargetLabels {
  discoveredLabels: Labels;
  labels: Labels;
  isDropped: boolean;
}

const activeTargetKVSearch = new KVSearch<Target>({
  shouldSort: true,
  indexedKeys: ['labels', 'discoveredLabels', ['discoveredLabels', /.*/], ['labels', /.*/]],
});

const droppedTargetKVSearch = new KVSearch<DroppedTarget>({
  shouldSort: true,
  indexedKeys: ['discoveredLabels', ['discoveredLabels', /.*/]],
});

export const processSummary = (
  activeTargets: Target[],
  droppedTargetCounts: Record<string, number>
): Record<string, { active: number; total: number }> => {
  const targets: Record<string, { active: number; total: number }> = {};

  // Get targets of each type along with the total and active end points
  for (const target of activeTargets) {
    const { scrapePool: name } = target;
    if (!targets[name]) {
      targets[name] = {
        total: 0,
        active: 0,
      };
    }
    targets[name].total++;
    targets[name].active++;
  }
  for (const name in targets) {
    if (!targets[name]) {
      targets[name] = {
        total: droppedTargetCounts[name],
        active: 0,
      };
    } else {
      targets[name].total += droppedTargetCounts[name];
    }
  }

  return targets;
};

export const processTargets = (activeTargets: Target[], droppedTargets: DroppedTarget[]): Record<string, TargetLabels[]> => {
  const labels: Record<string, TargetLabels[]> = {};

  for (const target of activeTargets) {
    const name = target.scrapePool;
    if (!labels[name]) {
      labels[name] = [];
    }
    labels[name].push({
      discoveredLabels: target.discoveredLabels,
      labels: target.labels,
      isDropped: false,
    });
  }

  for (const target of droppedTargets) {
    const { job: name } = target.discoveredLabels;
    if (!labels[name]) {
      labels[name] = [];
    }
    labels[name].push({
      discoveredLabels: target.discoveredLabels,
      isDropped: true,
      labels: {},
    });
  }

  return labels;
};

export const ServiceDiscoveryContent: FC<ServiceMap> = ({ activeTargets, droppedTargets, droppedTargetCounts }) => {
  const [activeTargetList, setActiveTargetList] = useState(activeTargets);
  const [droppedTargetList, setDroppedTargetList] = useState(droppedTargets);
  const [targetList, setTargetList] = useState(processSummary(activeTargets, droppedTargetCounts));
  const [labelList, setLabelList] = useState(processTargets(activeTargets, droppedTargets));

  const handleSearchChange = useCallback(
    (value: string) => {
      setQuerySearchFilter(value);
      if (value !== '') {
        const activeTargetResult = activeTargetKVSearch.filter(value.trim(), activeTargets);
        const droppedTargetResult = droppedTargetKVSearch.filter(value.trim(), droppedTargets);
        setActiveTargetList(activeTargetResult.map((value) => value.original));
        setDroppedTargetList(droppedTargetResult.map((value) => value.original));
      } else {
        setActiveTargetList(activeTargets);
      }
    },
    [activeTargets, droppedTargets]
  );

  const defaultValue = useMemo(getQuerySearchFilter, []);

  useEffect(() => {
    setTargetList(processSummary(activeTargetList, droppedTargetCounts));
    setLabelList(processTargets(activeTargetList, droppedTargetList));
  }, [activeTargetList, droppedTargetList, droppedTargetCounts]);

  return (
    <>
      <h2>Service Discovery</h2>
      <Container>
        <SearchBar defaultValue={defaultValue} handleChange={handleSearchChange} placeholder="Filter by labels" />
      </Container>
      <ul>
        {mapObjEntries(targetList, ([k, v]) => (
          <li key={k}>
            <a href={'#' + k}>
              {k} ({v.active} / {v.total} active targets)
            </a>
          </li>
        ))}
      </ul>
      <hr />
      {mapObjEntries(labelList, ([k, v]) => {
        return <LabelsTable value={v} name={k} key={k} />;
      })}
    </>
  );
};
ServiceDiscoveryContent.displayName = 'ServiceDiscoveryContent';

const ServicesWithStatusIndicator = withStatusIndicator(ServiceDiscoveryContent);

const ServiceDiscovery: FC = () => {
  const pathPrefix = usePathPrefix();
  const { response, error, isLoading } = useFetch<ServiceMap>(`${pathPrefix}/${API_PATH}/targets`);
  return (
    <ServicesWithStatusIndicator
      {...response.data}
      error={error}
      isLoading={isLoading}
      componentTitle="Service Discovery information"
    />
  );
};

export default ServiceDiscovery;
