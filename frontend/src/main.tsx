import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { Layout } from '@/components/Layout'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DocumentsPage } from '@/pages/DocumentsPage'
import { NewReviewPage } from '@/pages/NewReviewPage'
import { ReviewPage } from '@/pages/ReviewPage'
import { ReviewsPage } from '@/pages/ReviewsPage'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={200}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<ReviewsPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/new" element={<NewReviewPage />} />
            <Route path="/reviews/:id" element={<ReviewPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  </StrictMode>,
)
