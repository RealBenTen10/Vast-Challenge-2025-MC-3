  export const callApi = async (endpoint: string) => {
    setStatusMsg(`Calling ${endpoint}...`);
    try {
      const res = await fetch(`/api${endpoint}`);
      const data = await res.json();
      setStatusMsg(data.message || JSON.stringify(data));
    } catch (err) {
      setStatusMsg(`Failed to call ${endpoint}: ${err}`);
    }
  };

  export const loadGraph = async () => {
    try {
      const endpoint = useAggregated ? "/read-db-graph" : "/read-db-graph";
      const res = await fetch(`/api${endpoint}`);
      const data = await res.json();
      if (data.success) setGraphData({ nodes: data.nodes, links: data.links });
      else setStatusMsg(data["error-message"]);
    } catch (err) {
      setStatusMsg(`Graph loading failed: ${err}`);
    }
  };
