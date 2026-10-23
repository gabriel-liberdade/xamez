import type { Frame, Vec3 } from './math';
export type Aperture =
  | { kind: 'circle'; radiusMm: number }
  | { kind: 'rectangle'; widthMm: number; heightMm: number };
export type Shape = { kind: 'plane' } | { kind: 'sphere'; radiusMm: number };
export type Material = (
  | { model: 'constant'; n: number }
  | {
      model: 'sellmeier3';
      b: [number, number, number];
      cUm2: [number, number, number];
      validWavelengthNm: [number, number];
    }
) & {
  label: string;
  provenance: {
    reference: string;
    url?: string;
    retrievedOn?: string;
    note?: string;
  };
};
export type Source =
  | {
      kind: 'point';
      positionMm: Vec3;
      angular:
        | { model: 'uniform-cone'; halfAngleDeg: number }
        | { model: 'cosine-power'; fullWidthHalfMaxDeg: number };
    }
  | {
      kind: 'collimated';
      launchPlaneZMm: number;
      launchAperture: Aperture;
      fieldAnglesDeg: { x: number; y: number };
    };
export type Surface = {
  id: string;
  label: string;
  aperture: Aperture;
  frame: Frame;
  gapAfterMm: number | null;
  nBefore: number;
  nAfter: number;
} & (
  | { kind: 'interface'; shape: Shape }
  | { kind: 'mask' }
  | { kind: 'detector' }
  | { kind: 'thin-lens'; focalLengthMm: number }
  | { kind: 'mirror'; reflectance: number; incomingAxis: Vec3 }
);
export type System = {
  surfaces: Surface[];
  modelKind: 'real-surfaces' | 'paraxial-exploration';
  transmission: 'ideal' | 'fresnel-uncoated';
  wavelengthNm: number;
  source: Source;
};
export type Ray = { position: Vec3; direction: Vec3; weight: number };
export type Termination =
  | 'received'
  | 'outside_detector'
  | 'blocked_aperture'
  | 'missed_surface'
  | 'tir'
  | 'unsupported_direction'
  | 'numerical_failure';
export type Hit = {
  surfaceId: string;
  point: Vec3;
  local: Vec3;
  accepted: boolean;
  incident: number;
  transmitted: number;
  fresnel: number;
  mirrorAbsorption: number;
  paraxialWarning: boolean;
};
export type Trace = {
  termination: Termination;
  weight: number;
  geometricWeight: number;
  hits: Hit[];
  path: Vec3[];
  ray: Ray;
};
