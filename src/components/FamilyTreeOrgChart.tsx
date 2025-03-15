import React, { useState, useEffect, useRef } from 'react';
import { Tree, TreeNode } from 'react-organizational-chart';
import styled from 'styled-components';

// Define interfaces for our data structures
interface FamilyMember {
  id: number;
  name: string;
  parentId: number | null;
  photo?: string; // Optional photo URL
  title?: string; // Optional title/role
}

interface TreeNodeData extends FamilyMember {
  children: TreeNodeData[];
}

// Styled components for the org chart
const StyledNode = styled.div`
  padding: 12px;
  border-radius: 4px;
  display: inline-block;
  border: 1px solid #e5e7eb;
  background-color: white;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  min-width: 160px;
  position: relative;
  transition: all 0.2s;
  text-align: center;
  
  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }
`;

const PhotoContainer = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: #f3f4f6;
  margin: 0 auto 8px;
  overflow: hidden;
  border: 2px solid #e5e7eb;
`;

const Photo = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const DefaultPhoto = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: #9ca3af;
`;

const NodeTitle = styled.h3`
  margin: 0;
  font-weight: 600;
  color: #111827;
  font-size: 1rem;
  text-align: center;
`;

const NodeSubtitle = styled.p`
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 0.875rem;
  text-align: center;
`;

const StyledTreeNode = styled(TreeNode)`
  padding-top: 10px;
  
  /* Fix for broken lines */
  .oc-tree-node-line {
    height: 10px !important;
  }
  
  .oc-tree-node-children {
    margin-top: 0 !important;
  }
`;

const StyledTree = styled(Tree)`
  text-align: center;
  
  /* Fix for broken lines */
  .oc-tree {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .oc-tree-node {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .oc-tree-node-children {
    display: flex;
    margin-top: 0;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 4px;
  gap: 4px;
`;

const Button = styled.button`
  border: none;
  border-radius: 4px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s;
`;

const AddButton = styled(Button)`
  background-color: #0ea5e9;
  &:hover {
    background-color: #0284c7;
  }
`;

const RemoveButton = styled(Button)`
  background-color: #ef4444;
  &:hover {
    background-color: #dc2626;
  }
`;

const FamilyTreeOrgChart: React.FC = () => {
  const [familyData, setFamilyData] = useState<FamilyMember[]>([]);
  const [editingNode, setEditingNode] = useState<number | null>(null);
  const [newNodeName, setNewNodeName] = useState<string>('');
  const [newNodeTitle, setNewNodeTitle] = useState<string>('');
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
      parentId: parentId,
      title: ''
    };

    setFamilyData([...familyData, newMember]);
    setEditingNode(newId);
    setNewNodeName('');
    setNewNodeTitle('');
  };

  // Function to save the edited name
  const handleSaveName = (): void => {
    if (!newNodeName.trim()) {
      // If name is empty, remove the node
      if (editingNode !== null) {
        handleRemoveMember(editingNode);
      }
    } else {
      // Update the node name and title
      setFamilyData(familyData.map(item => 
        item.id === editingNode ? { ...item, name: newNodeName, title: newNodeTitle } : item
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
        setNewNodeTitle(node.title || '');
      }
    };

    return (
      <StyledTreeNode
        key={node.id}
        label={
          <div style={{ margin: '0 4px' }}>
            <StyledNode 
              onClick={handleNodeClick}
              onDoubleClick={handleNodeDoubleClick}
            >
              <PhotoContainer>
                {node.photo ? (
                  <Photo src={node.photo} alt={node.name} />
                ) : (
                  <DefaultPhoto>🐕</DefaultPhoto>
                )}
              </PhotoContainer>
              
              {isEditing ? (
                <div>
                  <input
                    type="text"
                    value={newNodeName}
                    onChange={(e) => setNewNodeName(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyDown={handleKeyPress}
                    className="bg-transparent border-b border-gray-300 focus:outline-none focus:border-blue-500 w-full text-center mb-2"
                    placeholder="Name"
                    dir="rtl"
                    autoFocus
                    onClick={(e) => e.stopPropagation()} // Prevent click from bubbling
                  />
                  <input
                    type="text"
                    value={newNodeTitle}
                    onChange={(e) => setNewNodeTitle(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="bg-transparent border-b border-gray-300 focus:outline-none focus:border-blue-500 w-full text-center text-sm"
                    placeholder="Title/Description"
                    dir="rtl"
                    onClick={(e) => e.stopPropagation()} // Prevent click from bubbling
                  />
                </div>
              ) : (
                <>
                  <NodeTitle>
                    {node.name}
                    {hasChildren && (
                      <span className="ml-2 text-gray-400 text-xs">
                        {isCollapsed ? "▼" : "▲"}
                      </span>
                    )}
                  </NodeTitle>
                  {node.title && <NodeSubtitle>{node.title}</NodeSubtitle>}
                </>
              )}
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
    <div className="family-tree-container p-8 max-w-full overflow-auto print:p-0 bg-gray-50 min-h-screen">
      <div className="controls mb-8 print:hidden">
        <h1 className="text-3xl font-bold text-gray-800 mb-4 text-center">
          Family Tree
        </h1>
        <div className="flex flex-wrap gap-4 justify-center">
          {familyData.length === 0 && (
            <button 
              onClick={() => handleAddMember(null)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center"
            >
              <span className="mr-2">+</span>
              Add Root Member
            </button>
          )}
          <button 
            onClick={saveTree}
            className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-md flex items-center"
          >
            <span className="mr-2">💾</span>
            Save Tree
          </button>
          <button 
            onClick={() => window.print()}
            className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-md flex items-center"
          >
            <span className="mr-2">🖨️</span>
            Print
          </button>
          <button 
            onClick={downloadAsImage}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
          >
            <span className="mr-2">📷</span>
            Download as Image
          </button>
        </div>
      </div>

      <div className="instructions bg-blue-50 p-4 rounded-md mb-6 print:hidden text-center">
        <p className="text-blue-800">
          <span className="font-bold">Instructions:</span> Double-click on a name to edit, single-click to expand/collapse branches
        </p>
      </div>

      <div 
        ref={treeContainerRef}
        className="tree-wrapper bg-white p-8 rounded-md shadow-md print:bg-white print:shadow-none border border-gray-200 overflow-x-auto"
      >
        <div className="min-w-max flex justify-center">
          {treeData.length > 0 ? (
            <StyledTree
              lineWidth={'1px'}
              lineColor={'#d1d5db'}
              lineBorderRadius={'0px'}
              nodePadding={'2px'}
              lineHeight={'10px'}
              label={<div className="text-gray-500 font-medium mb-2">Organization Chart</div>}
            >
              {treeData.map(rootNode => renderTreeNode(rootNode))}
            </StyledTree>
          ) : (
            <div className="text-center">
              <p className="text-gray-500 text-lg mb-4">No members in the family tree yet!</p>
              <button 
                onClick={() => handleAddMember(null)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center mx-auto"
              >
                <span className="mr-2">+</span>
                Add First Member
              </button>
            </div>
          )}
        </div>
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
      `}</style>
      
      {/* Global styles to fix the org chart lines */}
      <style jsx global>{`
        .oc-tree {
          padding: 10px 0;
        }
        
        .oc-tree-node {
          padding: 0;
        }
        
        .oc-tree-node-children {
          margin-top: 0 !important;
          padding-top: 10px;
        }
        
        .oc-tree-node-line {
          height: 10px !important;
        }
        
        /* Reduce spacing between siblings */
        .oc-hierarchy {
          gap: 5px !important;
        }
      `}</style>
    </div>
  );
};

export default FamilyTreeOrgChart; 