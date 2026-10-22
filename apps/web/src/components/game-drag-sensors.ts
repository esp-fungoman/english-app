import type { ComponentProps } from 'react';
import {
  DragDropProvider,
  KeyboardSensor,
  PointerSensor,
} from '@dnd-kit/react';
import { PointerActivationConstraints } from '@dnd-kit/dom';

export const gameDragSensors: ComponentProps<
  typeof DragDropProvider
>['sensors'] = [
  PointerSensor.configure({
    activationConstraints: (event) =>
      event.pointerType === 'touch'
        ? [
            new PointerActivationConstraints.Delay({
              value: 180,
              tolerance: { x: 8, y: 8 },
            }),
          ]
        : [new PointerActivationConstraints.Distance({ value: 5 })],
  }),
  KeyboardSensor.configure({ offset: 28 }),
];
