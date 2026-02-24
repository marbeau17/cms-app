// ============================================================
// CMS v1.2.0 - Root Application Component
// Agent C: Layout orchestration
// ============================================================
import { MainLayout } from './components/layout/MainLayout';
import { ToastContainer } from './components/common/Toast';

export default function App() {
  return (
    <>
      <MainLayout />
      <ToastContainer />
    </>
  );
}
