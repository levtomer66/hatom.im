export interface FamilyMember {
  id: number;
  name: string;
  parentId: number | null;
}

export interface FamilyMemberNode {
  id: number;
  name: string;
  children: FamilyMemberNode[];
}

// Function to convert flat array to hierarchical structure
export function buildFamilyTree(members: FamilyMember[]): FamilyMemberNode[] {
  const membersMap: Record<number, FamilyMemberNode> = {};
  
  // Create nodes without children
  members.forEach(member => {
    membersMap[member.id] = {
      id: member.id,
      name: member.name,
      children: []
    };
  });
  
  // Build the tree by adding children to their parents
  const rootNodes: FamilyMemberNode[] = [];
  
  members.forEach(member => {
    if (member.parentId === null) {
      // This is a root node
      rootNodes.push(membersMap[member.id]);
    } else if (membersMap[member.parentId]) {
      // Add this node as a child to its parent
      membersMap[member.parentId].children.push(membersMap[member.id]);
    }
  });
  
  return rootNodes;
} 