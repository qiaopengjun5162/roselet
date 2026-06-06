import '@/polyfill';
import { PropsWithChildren } from 'react';
import { FallingPetals } from '@/components/FallingPetals';
import './app.css';

function App({ children }: PropsWithChildren) {
  return (
    <>
      <FallingPetals />
      {children}
    </>
  );
}

export default App;
