'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRecipeReview } from '@/hooks/use-recipes'
import { RecipeReviewDocument } from '@/components/recipes/recipe-review-document'
import './recipe-review-print.css'

function formatPrintDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export default function RecipeReviewPrintPage() {
  const { data: recipes, isLoading, isError, error } = useRecipeReview()

  // Compute the date after mount so server and client render match (no hydration
  // mismatch), and so "Print date" reflects when the sheet is actually opened.
  const [printDate, setPrintDate] = useState('')
  useEffect(() => {
    setPrintDate(formatPrintDate(new Date()))
  }, [])

  return (
    <div className="rr-screen-wrap">
      <div className="rr-toolbar rr-no-print">
        <span className="rr-toolbar-title">
          Recipe Review{recipes ? ` · ${recipes.length} recipes` : ''}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link className="rr-back-link" href="/master-data/recipes">
            Back to recipes
          </Link>
          <button
            type="button"
            className="rr-print-btn"
            onClick={() => window.print()}
            disabled={isLoading || !recipes || recipes.length === 0}
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="rr-page rr-no-print" style={{ textAlign: 'center', color: '#555' }}>
          Loading recipes…
        </div>
      )}

      {isError && (
        <div className="rr-page rr-no-print" style={{ color: '#a11' }}>
          Failed to load recipes: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {!isLoading && !isError && recipes && (
        <RecipeReviewDocument recipes={recipes} printDate={printDate} />
      )}
    </div>
  )
}
