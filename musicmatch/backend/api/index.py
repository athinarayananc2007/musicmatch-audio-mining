"""
MusicMatch — Vercel Serverless Entry Point
===========================================
This module exposes the Flask WSGI app to the Vercel Python runtime.
Vercel detects the `app` variable and wraps it as a serverless function.
"""

import sys
import os
import ast

# ─── Vercel Serverless Librosa / lazy_loader Compatibility Patch ─────────────
# When Vercel bundles Python functions for AWS Lambda, it strips .pyi stub files.
# Librosa uses lazy_loader.attach_stub, which raises ValueError if __init__.pyi is
# missing. We intercept attach_stub to provide the in-memory stub definition when
# the on-disk .pyi file is stripped by Vercel.
try:
    import lazy_loader

    _LIBROSA_STUB = """
from . import beat, core, decompose, display, effects, feature, filters, onset, segment, sequence, util
from .core import load, stft, istft, resample, to_mono, amplitude_to_db, power_to_db
from .feature import mfcc, spectral_centroid, chroma_stft, zero_crossing_rate, rms
from .beat import beat_track
"""
    _orig_attach_stub = lazy_loader.attach_stub

    def _safe_attach_stub(package_name: str, filename: str):
        stubfile = (
            filename if filename.endswith("i") else f"{os.path.splitext(filename)[0]}.pyi"
        )
        if not os.path.exists(stubfile):
            class _StubVisitor(ast.NodeVisitor):
                def __init__(self):
                    self._submodules = set()
                    self._submod_attrs = {}

                def visit_ImportFrom(self, node):
                    if node.level != 1:
                        return
                    if node.module:
                        attrs = self._submod_attrs.setdefault(node.module, [])
                        attrs.extend([a.name for a in node.names if a.name != "*"])
                    else:
                        self._submodules.update([a.name for a in node.names])

            visitor = _StubVisitor()
            visitor.visit(ast.parse(_LIBROSA_STUB))
            return lazy_loader.attach(package_name, visitor._submodules, visitor._submod_attrs)

        return _orig_attach_stub(package_name, filename)

    lazy_loader.attach_stub = _safe_attach_stub
except Exception:
    pass

# Add parent directory to path so that backend modules (app.py, etc.) can be imported.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
