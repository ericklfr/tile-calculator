import { useState } from 'react'
import './App.css'
import PlantaComponent from './PlantaComponent'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
     <PlantaComponent>
     </PlantaComponent>
    </>
  )
}

export default App
