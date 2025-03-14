import React, { useState, useEffect, useRef } from 'react';
import { Tree, TreeNode } from 'react-organizational-chart';
import styled from 'styled-components';

// Define interfaces for our data structures
interface FamilyMember {
  id: number;
  name: string;
  parentId: number | null;
}

interface TreeNodeData extends FamilyMember {
  children: TreeNodeData[];
}

// Styled components for the org chart
const StyledNode = styled.div`
  padding: 12px;
  border-radius: 8px;
  display: inline-block;
  border: 2px solid #92400e;
  background-color: #fef3c7;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  min-width: 150px;
  position: relative;
  transition: all 0.3s;
  
  &:hover {
    border-color: #78350f;
    transform: translateY(-2px);
    box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
  }
  
  // Dog ears
  &::before, &::after {
    content: '';
    position: absolute;
    width: 20px;
    height: 20px;
    background-color: #92400e;
    border-radius: 50%;
    top: -10px;
  }
  
  &::before {
    left: -10px;
  }
  
  &::after {
    right: -10px;
  }
`;

const NodeTitle = styled.h3`
  margin: 0;
  font-weight: bold;
  color: #78350f;
  font-size: 1.125rem;
  text-align: center;
  direction: rtl;
`;

const StyledTreeNode = styled(TreeNode)`
  padding-top: 15px;
`;

const StyledTree = styled(Tree)`
  text-align: center;
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 6px;
  gap: 4px;
`;

const Button = styled.button`
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s;
`;

const AddButton = styled(Button)`
  background-color: #22c55e;
  &:hover {
    background-color: #16a34a;
  }
`;

const RemoveButton = styled(Button)`
  background-color: #ef4444;
  &:hover {
    background-color: #dc2626;
  }
`;

const CollapseButton = styled(Button)`
  background-color: #3b82f6;
  &:hover {
    background-color: #2563eb;
  }
`;

const FamilyTreeOrgChart: React.FC = () => {
  const [familyData, setFamilyData] = useState<FamilyMember[]>([]);
  const [editingNode, setEditingNode] = useState<number | null>(null);
  const [newNodeName, setNewNodeName] = useState<string>('');
  const [collapsedNodes, setCollapsedNodes] = useState<Set<number>>(new Set());
  const treeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch the family tree data
    fetch('/api/family-tree')
      .then(response => response.json())
      .then(data => setFamilyData(data))
      .catch(error => console.error('Error loading family tree data:', error));
  }, []);

  // Function to build the tree structure from flat data
  const buildTree = (items: FamilyMember[], parentId: number | null = null): TreeNodeData[] => {
    return items
      .filter(item => item.parentId === parentId)
      .map(item => ({
        ...item,
        children: buildTree(items, item.id)
      }));
  };

  // Function to add a new family member
  const handleAddMember = (parentId: number | null): void => {
    const newId = Math.max(...familyData.map(item => item.id), 0) + 1;
    const newMember: FamilyMember = {
      id: newId,
      name: '',
      parentId: parentId
    };

    setFamilyData([...familyData, newMember]);
    setEditingNode(newId);
    setNewNodeName('');
  };

  // Function to save the edited name
  const handleSaveName = (): void => {
    if (!newNodeName.trim()) {
      // If name is empty, remove the node
      if (editingNode !== null) {
        handleRemoveMember(editingNode);
      }
    } else {
      // Update the node name
      setFamilyData(familyData.map(item => 
        item.id === editingNode ? { ...item, name: newNodeName } : item
      ));
    }
    setEditingNode(null);
  };

  // Function to handle key press in the edit input
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      setEditingNode(null);
    }
  };

  // Function to remove a family member and all their descendants
  const handleRemoveMember = (id: number): void => {
    // Get all descendant IDs recursively
    const getDescendantIds = (parentId: number): number[] => {
      const directChildren = familyData.filter(item => item.parentId === parentId);
      const childrenIds = directChildren.map(child => child.id);
      const descendantIds = childrenIds.flatMap(childId => getDescendantIds(childId));
      return [parentId, ...descendantIds];
    };

    const idsToRemove = getDescendantIds(id);
    setFamilyData(familyData.filter(item => !idsToRemove.includes(item.id)));
  };

  // Function to toggle collapse state of a node
  const toggleCollapse = (id: number): void => {
    setCollapsedNodes(prevCollapsed => {
      const newCollapsed = new Set(prevCollapsed);
      if (newCollapsed.has(id)) {
        newCollapsed.delete(id);
      } else {
        newCollapsed.add(id);
      }
      return newCollapsed;
    });
  };

  // Function to download the tree as an image
  const downloadAsImage = (): void => {
    if (!treeContainerRef.current) return;
    
    // First, get all collapsed nodes and expand them temporarily
    const tempCollapsedNodes = new Set(collapsedNodes);
    setCollapsedNodes(new Set()); // Expand all nodes
    
    // Use setTimeout to ensure the DOM has updated with expanded nodes
    setTimeout(() => {
      import('html-to-image')
        .then((htmlToImage) => {
          // Set specific options for better quality and full capture
          htmlToImage.toPng(treeContainerRef.current!, { 
            quality: 1.0,
            pixelRatio: 2,
            width: treeContainerRef.current!.scrollWidth,
            height: treeContainerRef.current!.scrollHeight,
            style: {
              transform: 'scale(1)',
              transformOrigin: 'top left',
              width: `${treeContainerRef.current!.scrollWidth}px`,
              height: `${treeContainerRef.current!.scrollHeight}px`,
            }
          })
            .then((dataUrl: string) => {
              const link = document.createElement('a');
              link.download = 'family-tree.png';
              link.href = dataUrl;
              link.click();
              
              // Restore collapsed nodes after download
              setCollapsedNodes(tempCollapsedNodes);
            })
            .catch((error: Error) => {
              console.error('Error generating image:', error);
              alert('Failed to generate image. Check console for details.');
              // Restore collapsed nodes if there's an error
              setCollapsedNodes(tempCollapsedNodes);
            });
        })
        .catch((error: Error) => {
          console.error('Error loading html-to-image:', error);
          alert('Failed to load image generation library.');
          // Restore collapsed nodes if there's an error
          setCollapsedNodes(tempCollapsedNodes);
        });
    }, 300); // Wait for DOM to update
  };

  // Function to save the tree data
  const saveTree = async (): Promise<void> => {
    try {
      const response = await fetch('/api/family-tree', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(familyData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save tree');
      }
      
      alert('Family tree saved successfully!');
    } catch (error) {
      console.error('Error saving tree:', error);
      alert('Failed to save tree. Check console for details.');
    }
  };

  // Recursive component to render a tree node
  const renderTreeNode = (node: TreeNodeData) => {
    const isEditing = editingNode === node.id;
    const isCollapsed = collapsedNodes.has(node.id);
    const hasChildren = node.children.length > 0;

    const handleNodeClick = () => {
      if (hasChildren) {
        toggleCollapse(node.id);
      }
    };

    const handleNodeDoubleClick = () => {
      if (!isEditing) {
        setEditingNode(node.id);
        setNewNodeName(node.name);
      }
    };

    return (
      <StyledTreeNode
        key={node.id}
        label={
          <div>
            <StyledNode 
              onClick={handleNodeClick}
              onDoubleClick={handleNodeDoubleClick}
            >
              {isEditing ? (
                <input
                  type="text"
                  value={newNodeName}
                  onChange={(e) => setNewNodeName(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={handleKeyPress}
                  className="bg-transparent border-b-2 border-amber-600 focus:outline-none w-full text-center"
                  dir="rtl"
                  autoFocus
                  onClick={(e) => e.stopPropagation()} // Prevent click from bubbling
                />
              ) : (
                <NodeTitle>
                  {node.name}
                  {hasChildren && (
                    <span className="ml-2 text-amber-600 text-xs">
                      {isCollapsed ? "▼" : "▲"}
                    </span>
                  )}
                </NodeTitle>
              )}
              
              {/* Dog nose */}
              <div style={{
                position: 'absolute',
                bottom: '-8px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '16px',
                height: '16px',
                backgroundColor: '#451a03',
                borderRadius: '50%',
                zIndex: 1
              }}></div>
            </StyledNode>
            
            <ButtonGroup>
              <AddButton 
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddMember(node.id);
                }}
                title="Add Child"
              >
                +
              </AddButton>
              <RemoveButton 
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveMember(node.id);
                }}
                title="Remove"
              >
                ×
              </RemoveButton>
            </ButtonGroup>
          </div>
        }
      >
        {!isCollapsed && node.children.map(childNode => renderTreeNode(childNode))}
      </StyledTreeNode>
    );
  };

  // Build the tree structure
  const treeData = buildTree(familyData);

  return (
    <div className="family-tree-container p-8 max-w-full overflow-auto print:p-0 bg-amber-50 min-h-screen">
      <div className="controls mb-6 print:hidden">
        <h1 className="text-3xl font-bold text-amber-900 mb-4 flex items-center">
          <span className="mr-2">🐕</span>
          משפחת אוליבר - עץ משפחת הכלבים
          <span className="ml-2">🐕</span>
        </h1>
        <div className="flex flex-wrap gap-4">
          {familyData.length === 0 && (
            <button 
              onClick={() => handleAddMember(null)}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg flex items-center"
            >
              <span className="mr-2">🐶</span>
              Add Root Dog
            </button>
          )}
          <button 
            onClick={saveTree}
            className="bg-amber-800 hover:bg-amber-900 text-white px-4 py-2 rounded-lg flex items-center"
          >
            <span className="mr-2">💾</span>
            Save Family Tree
          </button>
          <button 
            onClick={() => window.print()}
            className="bg-amber-700 hover:bg-amber-800 text-white px-4 py-2 rounded-lg flex items-center"
          >
            <span className="mr-2">🖨️</span>
            Print Poster
          </button>
          <button 
            onClick={downloadAsImage}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg flex items-center"
          >
            <span className="mr-2">📷</span>
            Download as Image
          </button>
        </div>
      </div>

      <div className="instructions bg-amber-100 p-4 rounded-lg mb-6 print:hidden">
        <p className="text-amber-800">
          <span className="font-bold">Instructions:</span> Click on a dog to expand/collapse its children. 
          Double-click to edit a dog's name. Use the + button to add a new dog and the × button to remove a dog and all its descendants.
        </p>
      </div>

      <div 
        ref={treeContainerRef}
        className="tree-wrapper bg-white p-8 rounded-xl shadow-xl print:bg-white print:shadow-none border-4 border-amber-200 overflow-x-auto"
      >
        <div className="min-w-max flex justify-center">
          {treeData.length > 0 ? (
            <StyledTree
              lineWidth={'2px'}
              lineColor={'#92400e'}
              lineBorderRadius={'10px'}
              label={<div className="text-amber-800 font-bold mb-4">Family Tree</div>}
            >
              {treeData.map(rootNode => renderTreeNode(rootNode))}
            </StyledTree>
          ) : (
            <div className="text-center">
              <p className="text-amber-800 text-lg mb-4">No dogs in the family tree yet! 🐾</p>
              <button 
                onClick={() => handleAddMember(null)}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg flex items-center mx-auto"
              >
                <span className="mr-2">🐶</span>
                Add First Dog
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Paw print decorations */}
      <div className="paw-prints print:hidden">
        {[...Array(10)].map((_, i) => (
          <div 
            key={i} 
            className="paw-print text-amber-800/20 text-5xl absolute"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              transform: `rotate(${Math.random() * 360}deg)`
            }}
          >
            🐾
          </div>
        ))}
      </div>

      <style jsx>{`
        @media print {
          .family-tree-container {
            width: 100%;
            height: 100%;
            background-color: white;
          }
          .tree-wrapper {
            width: 100%;
            border: none;
          }
        }
        .paw-prints {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: -1;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
};

export default FamilyTreeOrgChart; 