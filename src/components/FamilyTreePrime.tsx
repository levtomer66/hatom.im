import React, { useState, useEffect, useRef } from 'react';
import { OrganizationChart } from 'primereact/organizationchart';
import styled from 'styled-components';
import 'primereact/resources/themes/lara-light-amber/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import { toPng } from 'html-to-image';

// Define interfaces for our data structures
interface FamilyMember {
  id: number;
  name: string;
  parentId: number | null;
}

// PrimeReact OrganizationChart expects data in this format
interface TreeNode {
  key?: string;
  type?: string;
  styleClass?: string;
  data?: {
    name: string;
    id: number;
    parentId?: number | null;
    childCount?: number;
    [key: string]: unknown;
  };
  children?: TreeNode[];
  style?: React.CSSProperties;
  expanded?: boolean;
  selectable?: boolean;
}

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const Button = styled.button`
  background-color: #92400e;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  
  &:hover {
    background-color: #78350f;
  }
  
  span {
    margin-right: 0.5rem;
  }
`;

// Custom styling for the organization chart
const StyledOrgChart = styled.div`
  .p-organizationchart {
    .p-organizationchart-node-content {
      padding: 1rem;
      border: 2px solid #92400e;
      background-color: #fef3c7;
      color: #78350f;
      border-radius: 8px;
      position: relative;
      transition: all 0.3s;
      
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
      }
      
      &::before, &::after {
        content: '';
        position: absolute;
        width: 24px;
        height: 24px;
        background-color: #92400e;
        border-radius: 50%;
        top: -12px;
      }
      
      &::before {
        left: -12px;
      }
      
      &::after {
        right: -12px;
      }
    }
    
    .p-organizationchart-line-down {
      background-color: #92400e;
    }
    
    .p-organizationchart-line-left, .p-organizationchart-line-right {
      border-color: #92400e;
    }
  }
`;

const FamilyTreePrime: React.FC = () => {
  const [familyData, setFamilyData] = useState<FamilyMember[]>([]);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [selection, setSelection] = useState<TreeNode | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch the family tree data
    fetch('/api/family-tree')
      .then(response => response.json())
      .then(data => {
        setFamilyData(data);
        // Convert the data to the format expected by OrganizationChart
        if (data.length > 0) {
          const transformedData = transformDataForOrgChart(data);
          setTreeData(transformedData);
        }
      })
      .catch(error => console.error('Error loading family tree data:', error));
  }, []);

  // Function to transform our flat data to the hierarchical structure needed by OrganizationChart
  const transformDataForOrgChart = (data: FamilyMember[]): TreeNode[] => {
    // Find the root node (node with no parent)
    const rootNode = data.find(item => item.parentId === null);
    if (!rootNode) return [];

    // Recursive function to build the tree
    const buildNode = (node: FamilyMember): TreeNode => {
      const children = data.filter(item => item.parentId === node.id);
      
      return {
        key: node.id.toString(),
        type: 'person',
        styleClass: 'dog-node',
        expanded: true,
        data: {
          id: node.id,
          name: node.name,
          parentId: node.parentId,
          childCount: children.length
        },
        children: children.length > 0 ? children.map(child => buildNode(child)) : []
      };
    };

    return [buildNode(rootNode)];
  };

  // Function to add a new family member
  const handleAddMember = async (parentId: number | null): Promise<void> => {
    const newId = Math.max(...familyData.map(item => item.id), 0) + 1;
    const newName = prompt('Enter name for new dog:');
    
    if (!newName) return; // User canceled
    
    const newMember: FamilyMember = {
      id: newId,
      name: newName,
      parentId: parentId
    };

    const updatedData = [...familyData, newMember];
    setFamilyData(updatedData);
    
    // Update the tree data
    if (updatedData.length > 0) {
      const transformedData = transformDataForOrgChart(updatedData);
      setTreeData(transformedData);
    }
    
    // Save to server
    await saveTree(updatedData);
  };

  // Function to save the tree data
  const saveTree = async (data: FamilyMember[] = familyData): Promise<void> => {
    try {
      const response = await fetch('/api/family-tree', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
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

  // Function to handle node selection
  const handleNodeSelect = (node: TreeNode) => {
    if (node && node.data) {
      const newName = prompt('Edit dog name:', node.data.name);
      if (newName && newName !== node.data.name) {
        const updatedData = familyData.map(item => 
          item.id === node.data!.id ? { ...item, name: newName } : item
        );
        setFamilyData(updatedData);
        
        // Update the tree data
        if (updatedData.length > 0) {
          const transformedData = transformDataForOrgChart(updatedData);
          setTreeData(transformedData);
        }
        
        // Save to server
        saveTree(updatedData);
      }
    }
  };

  // Custom node template
  const nodeTemplate = (node: TreeNode) => {
    if (!node.data) return null;
    
    return (
      <div className="node-content">
        <div className="node-header">
          <h3 style={{ margin: 0, textAlign: 'center', direction: 'rtl' }}>{node.data.name}</h3>
        </div>
        {node.data.childCount && node.data.childCount > 0 && (
          <div className="node-footer" style={{ marginTop: '8px', fontSize: '0.875rem' }}>
            {/* {node.data.childCount} {node.data.childCount === 1 ? 'child' : 'children'} */}
          </div>
        )}
        {/* Dog nose */}
        <div style={{
          position: 'absolute',
          bottom: -8,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 16,
          height: 16,
          backgroundColor: '#451a03',
          borderRadius: '50%',
          zIndex: 1,
        }}></div>
        
        {/* Add child button */}
        {/* <button
          onClick={(e) => {
            e.stopPropagation();
            handleAddMember(node.data.id);
          }}
          style={{
            position: 'absolute',
            bottom: -20,
            right: -20,
            width: 30,
            height: 30,
            backgroundColor: '#22c55e',
            color: 'white',
            borderRadius: '50%',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: 2,
          }}
          title="Add Child"
        >
          +
        </button> */}
      </div>
    );
  };

  // Function to download the chart as an image
  const downloadChartAsImage = () => {
    if (chartRef.current) {
      // Show loading indicator or message
      const loadingMessage = document.createElement('div');
      loadingMessage.style.position = 'fixed';
      loadingMessage.style.top = '50%';
      loadingMessage.style.left = '50%';
      loadingMessage.style.transform = 'translate(-50%, -50%)';
      loadingMessage.style.padding = '20px';
      loadingMessage.style.background = 'rgba(0, 0, 0, 0.7)';
      loadingMessage.style.color = 'white';
      loadingMessage.style.borderRadius = '8px';
      loadingMessage.style.zIndex = '9999';
      loadingMessage.textContent = 'Preparing poster image... This may take a moment.';
      document.body.appendChild(loadingMessage);

      // Get the chart element
      const chartElement = chartRef.current;
      
      // Save original styles to restore later
      const originalOverflow = chartElement.style.overflow;
      const originalWidth = chartElement.style.width;
      const originalHeight = chartElement.style.height;
      const originalPosition = chartElement.style.position;
      const originalTransform = chartElement.style.transform;
      const originalMaxWidth = chartElement.style.maxWidth;
      const originalMaxHeight = chartElement.style.maxHeight;
      
      // First, ensure we can see the full chart by expanding it
      chartElement.style.overflow = 'visible';
      chartElement.style.position = 'relative';
      chartElement.style.maxWidth = 'none';
      chartElement.style.maxHeight = 'none';
      
      // Give the browser a moment to apply these style changes
      setTimeout(() => {
        // Calculate dimensions for a poster with a 3:4 aspect ratio (30x40 inches)
        const posterWidth = 3000; // 30 inches at 100 DPI
        const posterHeight = 4000; // 40 inches at 100 DPI
        
        // Get the actual dimensions of the chart after style changes
        const actualWidth = chartElement.scrollWidth;
        const actualHeight = chartElement.scrollHeight;
        
        // Calculate the scale factor to fit the chart to the poster
        // while maintaining the aspect ratio
        const scaleX = posterWidth / actualWidth;
        const scaleY = posterHeight / actualHeight;
        const scale = Math.min(scaleX, scaleY);
        
        // Calculate the final dimensions that will maintain aspect ratio
        const finalWidth = Math.round(actualWidth * scale);
        const finalHeight = Math.round(actualHeight * scale);
        
        loadingMessage.textContent = 'Generating high-resolution poster image... This may take a moment.';
        
        // Use html-to-image with the calculated dimensions
        toPng(chartElement, { 
          quality: 1.0, // Maximum quality
          pixelRatio: 2, // Balance between quality and browser capability
          width: actualWidth,
          height: actualHeight,
          style: {
            transform: 'scale(1)', // Ensure no scaling issues
          },
          skipAutoScale: true,
          cacheBust: true,
          canvasWidth: finalWidth,
          canvasHeight: finalHeight
        })
          .then((dataUrl) => {
            // Create and trigger download
            const link = document.createElement('a');
            link.download = 'oliver-family-tree-poster.png';
            link.href = dataUrl;
            link.click();
            
            // Restore original styles
            chartElement.style.overflow = originalOverflow;
            chartElement.style.width = originalWidth;
            chartElement.style.height = originalHeight;
            chartElement.style.position = originalPosition;
            chartElement.style.transform = originalTransform;
            chartElement.style.maxWidth = originalMaxWidth;
            chartElement.style.maxHeight = originalMaxHeight;
            
            // Remove loading message
            document.body.removeChild(loadingMessage);
          })
          .catch((error) => {
            console.error('Error generating poster image:', error);
            alert('Failed to generate poster image. The image might be too large. Please try again with a smaller size.');
            
            // Restore original styles
            chartElement.style.overflow = originalOverflow;
            chartElement.style.width = originalWidth;
            chartElement.style.height = originalHeight;
            chartElement.style.position = originalPosition;
            chartElement.style.transform = originalTransform;
            chartElement.style.maxWidth = originalMaxWidth;
            chartElement.style.maxHeight = originalMaxHeight;
            
            // Remove loading message
            document.body.removeChild(loadingMessage);
          });
      }, 100); // Small delay to ensure styles are applied
    }
  };

  return (
    <div className="family-tree-container p-8 max-w-full overflow-auto print:p-0 bg-amber-50 min-h-screen">
      <div className="controls mb-6 print:hidden">
        <h1 className="text-3xl font-bold text-amber-900 mb-4 flex items-center">
          <span className="mr-2">🐕</span>
          משפחת אוליבר - עץ משפחת הכלבים
          <span className="ml-2">🐕</span>
        </h1>
        <ButtonGroup>
          {familyData.length === 0 && (
            <Button onClick={() => handleAddMember(null)}>
              <span>🐶</span>
              Add Root Dog
            </Button>
          )}
          <Button onClick={() => saveTree()}>
            <span>💾</span>
            Save Family Tree
          </Button>
          <Button onClick={() => window.print()}>
            <span>🖨️</span>
            Print Poster
          </Button>
          <Button onClick={downloadChartAsImage}>
            <span>📷</span>
            Download Image
          </Button>
        </ButtonGroup>
      </div>

      <div className="instructions bg-amber-100 p-4 rounded-lg mb-6 print:hidden">
        <p className="text-amber-800">
          <span className="font-bold">Instructions:</span> Click on a dog to edit its name.
          Use the &quot;+&quot; button to add a new dog to the family tree.
        </p>
      </div>

      <div ref={chartRef} className="tree-wrapper bg-white p-8 rounded-xl shadow-xl print:bg-white print:shadow-none border-4 border-amber-200 overflow-x-auto">
        <StyledOrgChart>
          {treeData.length > 0 ? (
            <OrganizationChart
              value={treeData}
              nodeTemplate={nodeTemplate}
              selectionMode="single"
              selection={selection}
              onSelectionChange={(e) => {
                if (e.data) {
                  setSelection(e.data as TreeNode);
                  handleNodeSelect(e.data as TreeNode);
                }
              }}
              className="org-chart"
            />
          ) : (
            <div className="text-center">
              <p className="text-amber-800 text-lg mb-4">No dogs in the family tree yet! 🐾</p>
              <Button onClick={() => handleAddMember(null)}>
                <span>🐶</span>
                Add First Dog
              </Button>
            </div>
          )}
        </StyledOrgChart>
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

export default FamilyTreePrime; 