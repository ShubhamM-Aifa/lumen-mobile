/**
 * DynamicField — dispatches to the correct field component based on
 * field.dataType and field.displayAs. This is the single entry point
 * for rendering any value field inside an option.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FieldDefinition, FieldValue } from '@lumen/shared';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

import { StringField }        from './StringField';
import { BooleanToggle }      from './BooleanToggle';
import { SeveritySlider }     from './SeveritySlider';
import { NumberStepper }      from './NumberStepper';
import { TemperatureStepper } from './TemperatureStepper';
import { DurationPicker }     from './DurationPicker';
import { TimeField }          from './TimeField';
import { EnumChips }          from './EnumChips';
import { EnumPictureGrid }    from './EnumPictureGrid';
import { ImageField }         from './ImageField';
import { BodyMap }            from './BodyMap';
import { ChestMap }           from './ChestMap';
import { ThreeJsBodyViewer }  from './ThreeJsBodyViewer';

interface Props {
  field: FieldDefinition;
  fieldValue: FieldValue | undefined;
  onChange: (partial: Pick<FieldValue, 'value' | 'unit'>) => void;
  /** User's preferred temperature display unit */
  tempPrefUnit?: 'C' | 'F';
}

export function DynamicField({ field, fieldValue, onChange, tempPrefUnit = 'C' }: Props) {
  const styles = useStyles();
  const v = fieldValue?.value;
  const unit = fieldValue?.unit ?? field.unit ?? field.allowedUnits?.[0] ?? '';

  const emit = (value: unknown, u?: string) =>
    onChange({ value, unit: u ?? unit });

  // Render label above field (except Boolean which renders its own label in a row)
  const showLabel = field.dataType !== 'boolean';

  const renderControl = () => {
    switch (field.dataType) {
      case 'range':
        return (
          <SeveritySlider
            field={field}
            value={typeof v === 'number' ? v : (field.min ?? 0)}
            onChange={(n) => emit(n)}
          />
        );

      case 'temperature':
        return (
          <TemperatureStepper
            field={field}
            value={typeof v === 'number' ? v : 37.0}
            prefUnit={tempPrefUnit}
            onChange={(c) => emit(c, '°C')}
          />
        );

      case 'number':
        return (
          <NumberStepper
            field={field}
            value={typeof v === 'number' ? v : (typeof field.defaultValue === 'number' ? field.defaultValue : 0)}
            unit={unit}
            onChange={(n, u) => emit(n, u)}
          />
        );

      case 'duration':
        return (
          <DurationPicker
            field={field}
            value={typeof v === 'number' ? v : 0}
            onChange={(s) => emit(s, 'seconds')}
          />
        );

      case 'time':
      case 'datetime':
        return (
          <TimeField
            field={field}
            value={typeof v === 'string' ? v : ''}
            onChange={(s) => emit(s)}
          />
        );

      case 'string':
        return (
          <StringField
            field={field}
            value={typeof v === 'string' ? v : ''}
            onChange={(s) => emit(s)}
          />
        );

      case 'boolean':
        return (
          <BooleanToggle
            field={field}
            value={typeof v === 'boolean' ? v : false}
            onChange={(b) => emit(b)}
          />
        );

      case 'enum': {
        const isGrid = field.displayAs === 'image-grid' || field.displayAs === 'color-swatch';
        const isMulti = field.displayAs === 'chips';
        if (isGrid) {
          return (
            <EnumPictureGrid
              field={field}
              value={typeof v === 'string' ? v : ''}
              onChange={(s) => emit(s)}
            />
          );
        }
        return (
          <EnumChips
            field={field}
            value={
              Array.isArray(v) ? v
              : typeof v === 'string' ? v
              : ''
            }
            multiSelect={isMulti}
            onChange={(val) => emit(val)}
          />
        );
      }

      case 'image':
        return (
          <ImageField
            field={field}
            value={Array.isArray(v) ? (v as string[]) : []}
            onChange={(uris) => emit(uris)}
          />
        );

      case 'location':
        if (field.displayAs === 'chest-map') {
          return (
            <ChestMap
              field={field}
              value={Array.isArray(v) ? (v as string[]) : []}
              onChange={(keys) => emit(keys)}
            />
          );
        }
        if (field.displayAs === 'joint-map-3d') {
          return (
            <ThreeJsBodyViewer
              mode="joints"
              value={Array.isArray(v) ? (v as string[]) : []}
              onChange={(keys) => emit(keys)}
            />
          );
        }
        if (field.displayAs === 'body-map-3d') {
          return (
            <ThreeJsBodyViewer
              mode="body"
              value={Array.isArray(v) ? (v as string[]) : []}
              onChange={(keys) => emit(keys)}
            />
          );
        }
        return (
          <BodyMap
            field={field}
            value={Array.isArray(v) ? (v as string[]) : []}
            onChange={(keys) => emit(keys)}
          />
        );

      default:
        return (
          <StringField
            field={field}
            value={typeof v === 'string' ? v : ''}
            onChange={(s) => emit(s)}
          />
        );
    }
  };

  return (
    <View style={styles.wrapper}>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{field.label}</Text>
          {field.required && <Text style={styles.required}> *</Text>}
        </View>
      )}
      {renderControl()}
    </View>
  );
}

const useStyles = createThemedStyles((palette) => ({
  wrapper: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  label: { ...typography.smallBold, color: palette.textSecondary },
  required: { ...typography.smallBold, color: palette.error },
}));
