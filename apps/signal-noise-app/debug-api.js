const testAPI = async () => {
  try {
    console.log('Testing individual entity API...')
    const response = await fetch('http://localhost:3001/api/entities/138')
    console.log('Response status:', response.status)
    
    if (!response.ok) {
      console.error('API response not ok:', response.statusText)
      return
    }
    
    const data = await response.json()
    console.log('API response successful')
    console.log('Entity name:', data.entity?.properties?.name)
    console.log('Founded:', data.entity?.properties?.founded)
    console.log('Digital Maturity:', data.entity?.properties?.digitalMaturity)
  } catch (error) {
    console.error('Error testing API:', error)
  }
}

testAPI()