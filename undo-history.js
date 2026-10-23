// One snapshot per intentional edit; continuous pointer gestures are grouped by the caller.
export function createUndoHistory(read, restore, limit=50) {
  const states=[];
  const serialize=state=>JSON.stringify(state);
  return {
    remember() {
      const state=structuredClone(read());
      const key=serialize(state);
      if(states.at(-1)?.key!==key)states.push({state,key});
      if(states.length>limit)states.shift();
    },
    undo() {
      const current=serialize(read());
      while(states.length){
        const previous=states.pop();
        if(previous.key!==current){restore(structuredClone(previous.state));return true}
      }
      return false;
    }
  };
}
